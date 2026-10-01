// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['n8n/wf-2-studio-prompts/**']
  }
)
