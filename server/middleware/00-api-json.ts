// n8n's HTTP node sends Accept with text/html. A thrown API error is then
// rendered as the Nuxt app, and the page auth middleware redirects to
// /login. Force this callback to be treated as JSON before that can happen.
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname.replace(/\/+$/, '') || '/'
  if (path !== '/api/mockups/webhook') return
  const headers = event.node.req.headers
  headers.accept = 'application/json'
})
