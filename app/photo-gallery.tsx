import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/hooks/useColors'
import { ratingService, type ActivityPhoto } from '@/services/ratingService'
import { radius, spacing } from '@/constants/theme'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const GRID_GAP = 2
const GRID_SIZE = (SCREEN_W - GRID_GAP * 2) / 3

export default function PhotoGalleryScreen() {
  const { activityId, startPhotoId } = useLocalSearchParams<{ activityId: string; startPhotoId?: string }>()
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const swipeRef = useRef<FlatList>(null)

  const [photos, setPhotos] = useState<ActivityPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isGrid, setIsGrid] = useState(false)

  useEffect(() => {
    ratingService.getPhotosForActivity(activityId).then(({ data }) => {
      setPhotos(data)
      setLoading(false)

      if (data.length > 0) {
        const idx = startPhotoId ? Math.max(0, data.findIndex((p) => p.id === startPhotoId)) : 0
        setCurrentIdx(idx)
        if (idx > 0) {
          setTimeout(() => swipeRef.current?.scrollToIndex({ index: idx, animated: false }), 50)
        }
      }
    })
  }, [activityId])

  const openSwipe = (idx: number) => {
    setCurrentIdx(idx)
    setIsGrid(false)
    // scroll after state update
    setTimeout(() => swipeRef.current?.scrollToIndex({ index: idx, animated: false }), 30)
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle='light-content' backgroundColor='#000' />
        <ActivityIndicator color='#fff' size='large' />
      </View>
    )
  }

  const current = photos[currentIdx]
  const topBarHeight = insets.top + 54

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle='light-content' backgroundColor='#000' />

      {/* ── Swipe view ── */}
      {!isGrid && (
        <>
          <FlatList
            ref={swipeRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
            keyExtractor={(p) => p.id}
            onMomentumScrollEnd={(e) => {
              setCurrentIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
            }}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' }}>
                <Image
                  source={{ uri: item.url }}
                  style={{ width: SCREEN_W, height: SCREEN_H * 0.78 }}
                  contentFit='contain'
                />
              </View>
            )}
          />

          {/* Dot indicators */}
          {photos.length > 1 && photos.length <= 12 && (
            <View style={{
              position: 'absolute',
              bottom: insets.bottom + spacing.lg,
              left: 0, right: 0,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}>
              {photos.map((_, i) => (
                <View key={i} style={{
                  width: i === currentIdx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === currentIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                }} />
              ))}
            </View>
          )}
        </>
      )}

      {/* ── Grid view ── */}
      {isGrid && (
        <FlatList
          data={photos}
          numColumns={3}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingTop: topBarHeight }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => openSwipe(index)} activeOpacity={0.85}>
              <Image
                source={{ uri: item.url }}
                style={{ width: GRID_SIZE, height: GRID_SIZE }}
                contentFit='cover'
              />
              {/* Username badge */}
              {item.profile?.username && (
                <View style={{
                  position: 'absolute',
                  bottom: 5, left: 5,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderRadius: radius.sm,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>@{item.profile.username}</Text>
                </View>
              )}
              {/* Grid gap via margin */}
              <View style={{ position: 'absolute', right: 0, bottom: 0, width: GRID_GAP, height: '100%', backgroundColor: '#000' }} />
              <View style={{ position: 'absolute', right: 0, bottom: 0, width: '100%', height: GRID_GAP, backgroundColor: '#000' }} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Top bar (always on top) ── */}
      <View style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.8}
        >
          <Ionicons name='arrow-back' size={20} color='#fff' />
        </TouchableOpacity>

        {/* Username (swipe view only) */}
        {!isGrid && current?.profile?.username && (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>@{current.profile.username}</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Counter (swipe view only) */}
        {!isGrid && (
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' }}>
            {currentIdx + 1} / {photos.length}
          </Text>
        )}

        {/* Grid / swipe toggle */}
        <TouchableOpacity
          onPress={() => setIsGrid((v) => !v)}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.8}
        >
          <Ionicons name={isGrid ? 'albums-outline' : 'grid-outline'} size={18} color='#fff' />
        </TouchableOpacity>
      </View>
    </View>
  )
}
