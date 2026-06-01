import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const { data, error } = await resend.emails.send({
  from: 'itsapps <dev@itsapps.at>', // use this for testing before you verify a domain
  to: 'tut.ench.amok@gmail.com',
  subject: 'Resend test',
  text: 'It works!',
})

if (error) {
  console.error('❌', error)
  process.exit(1)
}

console.log('✅ sent, id:', data?.id)
