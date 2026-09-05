import * as React from 'react'
import { render } from '@react-email/render'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'MatchPoint'
const SENDER_DOMAIN = 'notify.matchpointgaming.org'
const FROM_DOMAIN = 'matchpointgaming.org'

/**
 * Server-only helper: renders a registered template and enqueues it via
 * the shared transactional_emails queue. Bypasses the HTTP send route so
 * server-triggered notifications (e.g. payout status) don't need a JWT.
 */
export async function enqueueAppEmail(opts: {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, any>
  idempotencyKey?: string
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const { templateName, recipientEmail, templateData = {} } = opts
  const template = TEMPLATES[templateName]
  if (!template) return { ok: false, error: `unknown template: ${templateName}` }

  const effectiveRecipient = (template.to ?? recipientEmail ?? '').trim()
  if (!effectiveRecipient) return { ok: false, error: 'missing recipient' }
  const normalizedEmail = effectiveRecipient.toLowerCase()

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  // Suppression check
  const { data: suppressed } = await supabaseAdmin
    .from('suppressed_emails')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (suppressed) return { ok: false, error: 'recipient_suppressed' }

  const messageId = crypto.randomUUID()
  const idempotencyKey = opts.idempotencyKey ?? messageId

  // REQUIRED, not optional. The provider rejects a transactional send with no
  // unsubscribe token (400 missing_unsubscribe), so every notification this
  // helper enqueued was refused on arrival until this was added. Enqueuing a
  // message that cannot be accepted only buys five retries and a DLQ row.
  const { getOrCreateUnsubscribeToken } = await import('@/lib/email/unsubscribe.server')
  const unsubscribeToken = await getOrCreateUnsubscribeToken(supabaseAdmin, normalizedEmail)
  if (!unsubscribeToken) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Could not obtain an unsubscribe token',
    })
    return { ok: false, error: 'unsubscribe_token_unavailable' }
  }

  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const plainText = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  } as never)

  if (enqueueError) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: enqueueError.message,
    })
    return { ok: false, error: enqueueError.message }
  }

  return { ok: true, messageId }
}
