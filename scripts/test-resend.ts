import { Resend } from 'resend'

// RESEND_TEST_FROM: a sender on a domain verified in Resend; RESEND_TEST_TO: your own inbox
const { RESEND_API_KEY, RESEND_TEST_FROM, RESEND_TEST_TO } = process.env
if (!RESEND_API_KEY || !RESEND_TEST_FROM || !RESEND_TEST_TO) {
  console.error('❌ set RESEND_API_KEY, RESEND_TEST_FROM and RESEND_TEST_TO')
  process.exit(1)
}

const resend = new Resend(RESEND_API_KEY)

const { data, error } = await resend.emails.send({
  from: RESEND_TEST_FROM,
  to: RESEND_TEST_TO,
  subject: 'Resend test',
  text: 'It works!',
})

if (error) {
  console.error('❌', error)
  process.exit(1)
}

console.log('✅ sent, id:', data?.id)
