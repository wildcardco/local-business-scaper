import {
  gbpPhotoMessage,
  gbpPhotosFrom,
  googleBusinessIdFrom,
  photoCountFrom,
  type GbpPhoto
} from '~~/shared/gbp-listing'
import { fetchBusinessPhotos, fetchPlaceListing, type PlaceListing } from '~~/server/utils/place-listing'

export interface LoadedGbp {
  listing: PlaceListing | null
  googleBusinessId: string | null
  gbpPhotos: GbpPhoto[]
  photoCount: number | null
  photoMessage: string
}

/** Listing plus optional photos. Does not call the studio webhook. */
export async function loadGbpListing(placeId: string): Promise<LoadedGbp> {
  const listing = await fetchPlaceListing(placeId)
  if (!listing) {
    return {
      listing: null,
      googleBusinessId: null,
      gbpPhotos: [],
      photoCount: null,
      photoMessage: gbpPhotoMessage({ failed: true, count: 0 })
    }
  }

  const googleBusinessId = googleBusinessIdFrom(listing.business_id) || googleBusinessIdFrom(listing.google_id)
  const photoId = googleBusinessId || placeId
  let photos = gbpPhotosFrom(listing.photos_sample ?? listing.photos)
  let photoCount = photoCountFrom(listing.photo_count ?? listing.photos_count, photos)
  let failed = false
  try {
    const fetched = await fetchBusinessPhotos(photoId)
    const live = gbpPhotosFrom(fetched.photos)
    if (live.length) {
      photos = live
      photoCount = photoCountFrom(fetched.count, photos)
    } else if (fetched.count != null) {
      photos = []
      photoCount = photoCountFrom(fetched.count, [])
    }
  } catch {
    failed = true
  }

  return {
    listing,
    googleBusinessId,
    gbpPhotos: photos,
    photoCount,
    photoMessage: gbpPhotoMessage({ failed, count: photoCount ?? photos.length })
  }
}
