import { useState } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useProfil } from '../../../../../context/ProfilContext';
import { ToastData } from '../../../../../components/ui/toast';

interface UsePhotoManagementProps {
  setValue?: (name: string, value: any, options?: any) => void;
  getValues?: () => Record<string, any>;
  addToast?: (toast: Omit<ToastData, 'id'>) => void;
}

export const usePhotoManagement = (props?: UsePhotoManagementProps) => {
  const { profil } = useProfil();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  // Fonction pour charger l'aperçu de la photo
  const loadPhotoPreview = async (photoPath: string, setPreview: (url: string | null) => void) => {
    try {
      console.log('Génération de l\'URL signée pour la photo:', photoPath);
      const { data, error } = await supabase.storage
        .from('personnel-photos')
        .createSignedUrl(photoPath, 60);
      
      if (error) {
        console.error('Erreur lors de la création de l\'URL signée:', error);
        throw error;
      }

      console.log('URL signée créée avec succès, longueur:', data.signedUrl.length);
      setPreview(data.signedUrl);
    } catch (error) {
      console.error('Erreur lors du chargement de la photo:', error);
    }
  };

  // Gérer l'upload de la photo
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profil?.com_contrat_client_id || !props?.setValue || !props?.getValues || !props?.addToast) return;
    
    console.log('Début du téléversement de la photo:', file.name);

    setIsUploadingPhoto(true);
    try {
      // Créer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${profil.com_contrat_client_id}/${fileName}`;
      
      console.log('Chemin du fichier à téléverser:', filePath);

      // Uploader le fichier
      const { error: uploadError } = await supabase.storage
        .from('personnel-photos')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Erreur lors du téléversement:', uploadError);
        throw uploadError;
      }
      
      console.log('Photo téléversée avec succès. Chemin:', filePath);

      // Mettre à jour le formulaire avec le chemin du fichier
      props.setValue('lien_photo', filePath);
      console.log('Chemin de la photo mis à jour dans le formulaire:', props.getValues('lien_photo'));
      
      // Charger l'aperçu
      loadPhotoPreview(filePath, setPhotoPreview);
      
      props.addToast({
        label: 'Photo téléversée avec succès',
        icon: 'Check',
        color: '#22c55e'
      });
    } catch (error) {
      console.error('Erreur lors du téléversement de la photo:', error);
      props.addToast({
        label: 'Erreur lors du téléversement de la photo',
        icon: 'AlertTriangle',
        color: '#ef4444'
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Supprimer la photo
  const handleRemovePhoto = async () => {
    if (!props?.setValue || !props?.getValues || !props?.addToast) return;
    
    const photoPath = props.getValues().lien_photo;
    if (!photoPath) return;

    console.log('Suppression de la photo:', photoPath);
    try {
      const { error } = await supabase.storage
        .from('personnel-photos')
        .remove([photoPath]);

      if (error) throw error;

      console.log('Photo supprimée avec succès');
      props.setValue('lien_photo', '', { shouldDirty: true });
      console.log('Valeur du champ lien_photo après suppression:', props.getValues('lien_photo'));
      setPhotoPreview(null);
      
      props.addToast({
        label: 'Photo supprimée avec succès',
        icon: 'Check',
        color: '#22c55e'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la photo:', error);
      props.addToast({
        label: 'Erreur lors de la suppression de la photo',
        icon: 'AlertTriangle',
        color: '#ef4444'
      });
    }
  };

  return {
    photoPreview,
    setPhotoPreview,
    isUploadingPhoto,
    loadPhotoPreview,
    handlePhotoUpload,
    handleRemovePhoto
  };
};