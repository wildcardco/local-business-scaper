<script setup lang="ts">
interface Template {
  id?: string
  name: string
  subject: string
  body: string
  isActive: boolean
}

const props = defineProps<{
  template?: Template | null
  mode: 'create' | 'edit'
}>()

const emit = defineEmits<{
  save: [template: Template]
  cancel: []
}>()

const form = ref<Template>({
  name: props.template?.name || '',
  subject: props.template?.subject || '',
  body: props.template?.body || '',
  isActive: props.template?.isActive ?? true
})

const availableVariables = [
  { name: 'businessName', description: 'Name of the business', display: '{{businessName}}' },
  { name: 'category', description: 'Business category', display: '{{category}}' },
  { name: 'city', description: 'City name', display: '{{city}}' },
  { name: 'state', description: 'State name', display: '{{state}}' },
  { name: 'performanceScore', description: 'Website performance score', display: '{{performanceScore}}' },
  { name: 'seoScore', description: 'Website SEO score', display: '{{seoScore}}' },
  { name: 'accessibilityScore', description: 'Website accessibility score', display: '{{accessibilityScore}}' },
  { name: 'issues', description: 'List of issues (use #issues...)', display: '{{#issues}}' }
]

function insertVariable(variable: string) {
  form.value.body += `{{${variable}}}`
}

const canSave = computed(() =>
  form.value.name.trim() &&
  form.value.subject.trim() &&
  form.value.body.trim()
)

function handleSave() {
  if (!canSave.value) return
  emit('save', {
    ...form.value,
    id: props.template?.id
  })
}

watch(() => props.template, (newTemplate) => {
  if (newTemplate) {
    form.value = {
      name: newTemplate.name,
      subject: newTemplate.subject,
      body: newTemplate.body,
      isActive: newTemplate.isActive
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Template Name">
      <UInput
        v-model="form.name"
        placeholder="e.g., no_website, poor_performance"
      />
    </UFormField>

    <UFormField label="Subject Line">
      <UInput
        v-model="form.subject"
        placeholder="Email subject with {{variables}}"
      />
    </UFormField>

    <UFormField label="Email Body">
      <UTextarea
        v-model="form.body"
        placeholder="Write your email template here. Use {{variableName}} for dynamic content."
        rows="12"
        class="font-mono text-sm"
      />
    </UFormField>

    <!-- Variables Reference -->
    <UCard>
      <template #header>
        <h4 class="text-sm font-medium">Available Variables</h4>
      </template>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="variable in availableVariables"
          :key="variable.name"
          size="xs"
          variant="soft"
          @click="insertVariable(variable.name)"
        >
          <UTooltip :text="variable.description">
            <span>{{ variable.display }}</span>
          </UTooltip>
        </UButton>
      </div>
    </UCard>

    <UCheckbox
      v-model="form.isActive"
      label="Template is active"
    />

    <div class="flex gap-2 pt-4">
      <UButton
        :disabled="!canSave"
        @click="handleSave"
      >
        {{ mode === 'create' ? 'Create Template' : 'Save Changes' }}
      </UButton>
      <UButton
        variant="ghost"
        @click="emit('cancel')"
      >
        Cancel
      </UButton>
    </div>
  </div>
</template>

