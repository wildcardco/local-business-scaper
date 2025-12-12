import ImageKit from 'imagekit'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  if (!config.imageKitPrivateKey || !config.imageKitPublicKey || !config.imageKitUrl) {
    throw createError({
      statusCode: 500,
      message: 'ImageKit configuration is missing'
    })
  }

  try {
    const imagekit = new ImageKit({
      publicKey: config.imageKitPublicKey,
      privateKey: config.imageKitPrivateKey,
      urlEndpoint: config.imageKitUrl
    })

    const authenticationParameters = imagekit.getAuthenticationParameters()
    
    return {
      success: true,
      ...authenticationParameters
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      message: `Failed to get ImageKit auth: ${errorMessage}`
    })
  }
})


