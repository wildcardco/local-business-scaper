<script setup lang="ts">
const toast = useToast()

interface Template {
  id: string
  name: string
  subject: string
  body: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const { data, pending, refresh } = await useFetch('/api/templates')
const templates = computed(() => (data.value?.templates || []) as Template[])

const showEditor = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const selectedTemplate = ref<Template | null>(null)

function openCreate() {
  selectedTemplate.value = null
  editorMode.value = 'create'
  showEditor.value = true
}

function openEdit(template: Template) {
  selectedTemplate.value = template
  editorMode.value = 'edit'
  showEditor.value = true
}

async function handleSave(templateData: { id?: string; name: string; subject: string; body: string; isActive: boolean }) {
  try {
    if (editorMode.value === 'create') {
      await $fetch('/api/templates', {
        method: 'POST',
        body: templateData
      })
      toast.add({ title: 'Template created', color: 'success' })
    } else {
      await $fetch(`/api/templates/${templateData.id}`, {
        method: 'PATCH',
        body: templateData
      })
      toast.add({ title: 'Template updated', color: 'success' })
    }

    showEditor.value = false
    await refresh()
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save'
    toast.add({ title: 'Error', description: errorMessage, color: 'error' })
  }
}

async function handleDelete(id: string) {
  try {
    await $fetch(`/api/templates/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Template deleted', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to delete', color: 'error' })
  }
}

async function seedTemplates() {
  try {
    const result = await $fetch('/api/templates/seed', { method: 'POST' })
    toast.add({ title: result.message, color: result.success ? 'success' : 'warning' })
    await refresh()
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to seed'
    toast.add({ title: 'Error', description: errorMessage, color: 'error' })
  }
}

async function toggleActive(template: Template) {
  try {
    await $fetch(`/api/templates/${template.id}`, {
      method: 'PATCH',
      body: { isActive: !template.isActive }
    })
    toast.add({
      title: template.isActive ? 'Template deactivated' : 'Template activated',
      color: 'success'
    })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to update', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Email Templates</h1>
        <p class="text-muted">Manage email templates for outreach campaigns.</p>
      </div>
      <div class="flex gap-2">
        <UButton
          v-if="templates.length === 0"
          icon="i-lucide-wand-2"
          variant="outline"
          @click="seedTemplates"
        >
          Add Default Templates
        </UButton>
        <UButton
          icon="i-lucide-plus"
          @click="openCreate"
        >
          New Template
        </UButton>
      </div>
    </div>

    <!-- Editor Modal -->
    <UModal v-model:open="showEditor">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">
              {{ editorMode === 'create' ? 'Create Template' : 'Edit Template' }}
            </h2>
          </template>

          <EmailTemplateEditor
            :template="selectedTemplate"
            :mode="editorMode"
            @save="handleSave"
            @cancel="showEditor = false"
          />
        </UCard>
      </template>
    </UModal>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-primary" />
    </div>

    <!-- Empty State -->
    <UCard v-else-if="templates.length === 0">
      <div class="text-center py-12">
        <UIcon name="i-lucide-mail" class="text-4xl text-muted mb-3" />
        <h3 class="text-lg font-semibold mb-2">No Templates</h3>
        <p class="text-muted mb-4">
          Create email templates for your outreach campaigns
        </p>
        <div class="flex justify-center gap-2">
          <UButton @click="seedTemplates" variant="outline">
            Add Default Templates
          </UButton>
          <UButton @click="openCreate">
            Create New
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Templates Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard v-for="template in templates" :key="template.id">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-mail" class="text-primary" />
              <span class="font-semibold">{{ template.name }}</span>
            </div>
            <UBadge
              :color="template.isActive ? 'success' : 'neutral'"
              variant="soft"
              size="xs"
            >
              {{ template.isActive ? 'Active' : 'Inactive' }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-3">
          <div>
            <p class="text-xs text-muted mb-1">Subject</p>
            <p class="text-sm font-medium truncate">{{ template.subject }}</p>
          </div>

          <div>
            <p class="text-xs text-muted mb-1">Preview</p>
            <p class="text-sm text-muted line-clamp-3">
              {{ template.body.substring(0, 150) }}...
            </p>
          </div>
        </div>

        <template #footer>
          <div class="flex gap-2">
            <UButton
              icon="i-lucide-edit"
              variant="ghost"
              size="sm"
              @click="openEdit(template)"
            >
              Edit
            </UButton>
            <UButton
              :icon="template.isActive ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              variant="ghost"
              size="sm"
              @click="toggleActive(template)"
            >
              {{ template.isActive ? 'Deactivate' : 'Activate' }}
            </UButton>
            <div class="flex-1" />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="handleDelete(template.id)"
            />
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
