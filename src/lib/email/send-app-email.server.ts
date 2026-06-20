import * as React from 'react'
import { render } from '@react-email/render'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'matchpoint-gaming'
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
