export default defineAppConfig({
  ui: {
    colors: {
      primary: 'wcRed',
      secondary: 'wcGold',
      neutral: 'wcNeutral',
      success: 'wcSuccess',
      warning: 'wcWarning',
      error: 'wcError',
      info: 'wcInfo'
    },
    button: {
      slots: {
        base: 'font-display font-semibold tracking-tight transition-transform active:scale-[0.97]'
      }
    },
    card: {
      slots: {
        root: 'bg-muted ring ring-default rounded-[var(--radius-wc-lg)]'
      }
    },
    modal: {
      slots: {
        content: 'bg-muted ring ring-default',
        title: 'font-display text-highlighted font-semibold'
      }
    },
    badge: {
      slots: {
        base: 'font-medium'
      }
    },
    formField: {
      slots: {
        label: 'font-medium text-toned'
      }
    },
    icons: {
      loading: 'i-lucide-loader-circle',
      search: 'i-lucide-search',
      menu: 'i-lucide-menu',
      close: 'i-lucide-x'
    }
  }
})
