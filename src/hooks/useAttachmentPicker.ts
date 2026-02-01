import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

export interface AttachmentPickerResult {
  uri: string;
  name: string;
  type?: string;
  size?: number;
}

export type PickerType = 'image' | 'document';

// Limite de 50MB em bytes
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const useAttachmentPicker = () => {
  const [isPickerLoading, setIsPickerLoading] = useState(false);

  /**
   * Valida se o tamanho do arquivo está dentro do limite permitido.
   * Retorna true se válido, false caso contrário (e mostra alerta).
   */
  const validateFileSize = (fileSize?: number): boolean => {
    if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
      Alert.alert(
        'File too large',
        'Maximum file size is 50MB.'
      );
      return false;
    }
    return true;
  };

  /**
   * Solicita permissões necessárias
   */
  const requestPermissions = async (type: PickerType): Promise<boolean> => {
    if (type === 'image') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to photo library in settings.'
        );
        return false;
      }
    }
    return true;
  };

  /**
   * Abre o seletor de imagens
   * ✅ RETORNA ARRAY DE ANEXOS
   */
  const pickImage = async (multiple: boolean = true): Promise<AttachmentPickerResult[] | null> => {
    try {
      setIsPickerLoading(true);
      const hasPermission = await requestPermissions('image');
      if (!hasPermission) return null;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8, // Comprime para reduzir tamanho
        exif: false,
        allowsMultipleSelection: multiple,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const validAssets: AttachmentPickerResult[] = [];

        for (const asset of result.assets) {
          // Valida tamanho antes de adicionar
          if (validateFileSize(asset.fileSize)) {
            validAssets.push({
              uri: asset.uri,
              name: asset.fileName || `image_${Date.now()}.jpg`,
              type: asset.mimeType || 'image/jpeg',
              size: asset.fileSize,
            });
          }
        }

        return validAssets.length > 0 ? validAssets : null;
      }

      return null;
    } catch (error) {
      console.error('[AttachmentPicker] Image picker error:', error);
      Alert.alert('Error', 'Could not select images');
      return null;
    } finally {
      setIsPickerLoading(false);
    }
  };

  /**
   * Abre o seletor de documentos
   * ✅ RETORNA ARRAY DE ANEXOS
   * ✅ Suporta ZIP e outros tipos
   */
  const pickDocument = async (): Promise<AttachmentPickerResult[] | null> => {
    try {
      setIsPickerLoading(true);

      const result = await DocumentPicker.getDocumentAsync({
        // Adicionado zip e compressed explicitamente junto com audio/video/pdf
        type: ['*/*', 'application/zip', 'application/x-zip-compressed', 'application/pdf', 'audio/*'],
        copyToCacheDirectory: true,
        multiple: true, // ✅ HABILITA SELEÇÃO MÚLTIPLA
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const validAssets: AttachmentPickerResult[] = [];

        for (const asset of result.assets) {
          // Valida tamanho antes de adicionar
          if (validateFileSize(asset.size)) {
            // Refina o tipo se vier genérico ou undefined
            let mimeType = asset.mimeType;
            if (!mimeType) {
                 if (asset.name.endsWith('.zip')) mimeType = 'application/zip';
                 else if (asset.name.endsWith('.pdf')) mimeType = 'application/pdf';
            }

            validAssets.push({
              uri: asset.uri,
              name: asset.name,
              type: mimeType || 'application/octet-stream',
              size: asset.size,
            });
          }
        }

        return validAssets.length > 0 ? validAssets : null;
      }

      return null;
    } catch (error) {
      console.error('[AttachmentPicker] Document picker error:', error);
      Alert.alert('Error', 'Could not select documents');
      return null;
    } finally {
      setIsPickerLoading(false);
    }
  };

  /**
   * Abre a câmera para tirar foto
   * ✅ RETORNA ARRAY DE ANEXOS (com 1 item)
   */
  const takePhoto = async (): Promise<AttachmentPickerResult[] | null> => {
    try {
      setIsPickerLoading(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to camera in settings.'
        );
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Valida tamanho da foto tirada (raro exceder 50MB, mas consistente)
        if (!validateFileSize(asset.fileSize)) {
          return null;
        }

        // ✅ Retorna como um array para consistência
        return [{
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: asset.fileSize,
        }];
      }

      return null;
    } catch (error) {
      console.error('[AttachmentPicker] Camera error:', error);
      Alert.alert('Error', 'Could not take photo');
      return null;
    } finally {
      setIsPickerLoading(false);
    }
  };

  return {
    pickImage,
    pickDocument,
    takePhoto,
    isPickerLoading,
  };
};
