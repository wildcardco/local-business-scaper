export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const searchQuery = query.query as string
  const region = (query.region as string) || 'us'

  if (!searchQuery || searchQuery.length < 2) {
    return { suggestions: [] }
  }

  const config = useRuntimeConfig()

  try {
    const response = await $fetch<{
      status: string
      data: Array<{
        description: string
        place_id: string
        main_text: string
        secondary_text: string
        latitude?: number
        longitude?: number
      }>
    }>('https://local-business-data.p.rapidapi.com/autocomplete', {
      headers: {
        'x-rapidapi-key': config.rapidApiKey,
        'x-rapidapi-host': config.rapidApiHost
      },
      query: {
        query: searchQuery,
        region: region,
        language: 'en'
      }
    })

    if (response.status === 'OK' && response.data) {
      const suggestions = response.data
        .filter(item => item.main_text && item.secondary_text)
        .map(item => ({
          label: `${item.main_text}, ${item.secondary_text}`,
          value: `${item.main_text}, ${item.secondary_text}`, // Use full location as value
          placeId: item.place_id,
          lat: item.latitude,
          lng: item.longitude
        }))
        .slice(0, 8) // Limit to 8 suggestions

      return { suggestions }
    }

    return { suggestions: [] }
  } catch (error) {
    console.error('Autocomplete API error:', error)
    return { suggestions: [] }
  }
})

















