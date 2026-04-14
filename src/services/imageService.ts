import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { decode } from 'base64-arraybuffer'

export const imageService = {
  /**
   * Opens the device library to pick an image.
   * Returns the base64 data and uri, or null if canceled.
   */
  async pickImage(aspect: [number, number] = [1, 1]) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect,
      quality: 0.7, // Compress image to save storage
      base64: true, // Required for Supabase upload in RN
    })

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null
    }

    return result.assets[0]
  },

  /**
   * Uploads a base64 image string to Supabase Storage.
   * Returns the public URL of the uploaded image.
   */
  async uploadImage(
    bucketName: string,
    filePath: string,
    base64Data: string,
    contentType = 'image/jpeg'
  ) {
    try {
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, decode(base64Data), {
          contentType,
          upsert: true,
        })

      if (error) throw error

      // Get the public URL to save in the database
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
      return { url: data.publicUrl, error: null }
    } catch (error) {
      console.error('Image Upload Error:', error)
      return { url: null, error }
    }
  },
}
