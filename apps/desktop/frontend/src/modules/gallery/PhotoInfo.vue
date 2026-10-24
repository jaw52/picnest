<script setup lang="ts">
import type { Photo } from '~/types/photo'
import { useI18n } from 'vue-i18n'
import AppTooltip from '~/components/AppTooltip.vue'
import StarRating from '~/components/StarRating.vue'
import { useFileName } from '~/composables/useFileName'
import { usePhotoDetails } from '~/composables/usePhotoDetails'
import { useRatePhoto } from '~/composables/useRatePhoto'
import { useRenamePhoto } from '~/composables/useRenamePhoto'
import { fileExtension, formatFileSize, formatUnixSeconds } from '~/lib/format'
import { isLibraryPath } from '~/lib/library'
import FileNameRow from './FileNameRow.vue'
import InfoRow from './InfoRow.vue'
import InfoSection from './InfoSection.vue'

const { photo, folderPath } = defineProps<{ photo: Photo, folderPath: string | null }>()

const { t } = useI18n()
const rate = useRatePhoto(() => folderPath)
const renamePhoto = useRenamePhoto(() => folderPath)
const { details } = usePhotoDetails(() => photo.path)
const fileName = useFileName(() => photo)
</script>

<template>
  <div class="px-3 py-2">
    <FileNameRow :photo="photo" :renamable="!isLibraryPath(folderPath)" @rename="name => renamePhoto(photo, name)" />
    <AppTooltip :content="t('photoInfo.rateHint')" side="bottom">
      <div class="mt-1.5">
        <StarRating :rating="photo.rating" @change="r => rate([photo], r)" />
      </div>
    </AppTooltip>
  </div>

  <InfoSection :title="t('photoInfo.basics')">
    <InfoRow :label="t('photoInfo.dimensions')" :value="photo.isCloudPlaceholder ? t('photoInfo.unknown') : `${photo.width} × ${photo.height}`" />
    <InfoRow :label="t('photoInfo.type')" :value="fileExtension(fileName) || t('photoInfo.unknown')" />
    <InfoRow v-if="!isLibraryPath(folderPath)" :label="t('photoInfo.size')" :value="details ? formatFileSize(details.fileSize) : '...'" />
    <InfoRow v-if="details?.created !== undefined" :label="t('photoInfo.created')" :value="formatUnixSeconds(details.created)" />
    <InfoRow :label="t('photoInfo.modified')" :value="formatUnixSeconds(photo.modified)" />
  </InfoSection>

  <InfoSection v-if="details?.exif" title="EXIF">
    <InfoRow v-if="details.exif.cameraMake" :label="t('photoInfo.make')" :value="details.exif.cameraMake" />
    <InfoRow v-if="details.exif.cameraModel" :label="t('photoInfo.model')" :value="details.exif.cameraModel" />
    <InfoRow v-if="details.exif.lensModel" :label="t('photoInfo.lens')" :value="details.exif.lensModel" />
    <InfoRow v-if="details.exif.focalLength" :label="t('photoInfo.focalLength')" :value="details.exif.focalLength" />
    <InfoRow v-if="details.exif.aperture" :label="t('photoInfo.aperture')" :value="details.exif.aperture" />
    <InfoRow v-if="details.exif.shutterSpeed" :label="t('photoInfo.shutterSpeed')" :value="details.exif.shutterSpeed" />
    <InfoRow v-if="details.exif.iso" label="ISO" :value="details.exif.iso" />
    <InfoRow v-if="details.exif.exposureBias" :label="t('photoInfo.exposureBias')" :value="details.exif.exposureBias" />
    <InfoRow v-if="details.exif.takenAt" :label="t('photoInfo.takenAt')" :value="details.exif.takenAt" />
  </InfoSection>
</template>
