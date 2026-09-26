export default defineNuxtPlugin(() => {
  const { loggedIn } = useUserSession()
  const { refreshStatus } = useStudioSync()

  function resume() {
    if (loggedIn.value) refreshStatus().catch(() => undefined)
  }

  watch(loggedIn, (isLoggedIn) => {
    if (isLoggedIn) resume()
  }, { immediate: true })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resume()
  })
})
