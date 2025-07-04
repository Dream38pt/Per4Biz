import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useProfil } from '../../../context/ProfilContext';
import { Form, FormField, FormInput, FormActions } from '../../ui/form';
import { Toggle } from '../../ui/toggle';
import { Dropdown, DropdownOption } from '../../ui/dropdown';
import { Button } from '../../ui/button';

interface Entite {
  id: string;
  code: string;
  libelle: string;
}

interface NatureFluxFormData {
  code: string;
  libelle: string;
  description?: string;
  id_entite: string;
  actif: boolean;
}

interface NatureFluxFormProps {
  initialData?: NatureFluxFormData;
  onSubmit: (data: NatureFluxFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function NatureFluxForm({
  initialData = {
    code: '',
    libelle: '',
    description: '',
    id_entite: '',
    actif: true
  },
  onSubmit,
  onCancel,
  isSubmitting = false
}: NatureFluxFormProps) {
  const [formData, setFormData] = useState<NatureFluxFormData>(initialData);
  const [entites, setEntites] = useState<Entite[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof NatureFluxFormData, string>>>({});
  const { profil } = useProfil();

  useEffect(() => {
    const fetchEntites = async () => {
      if (!profil?.com_contrat_client_id) return;

      const { data } = await supabase
        .from('com_entite')
        .select('id, code, libelle')
        .eq('actif', true)
        .eq('com_contrat_client_id', profil.com_contrat_client_id)
        .order('libelle');

      if (data) {
        setEntites(data);
      }
    };

    fetchEntites();
  }, [profil?.com_contrat_client_id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Effacer l'erreur quand l'utilisateur commence à taper
    if (errors[name as keyof NatureFluxFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleToggleChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      actif: checked
    }));
  };

  const handleEntiteChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      id_entite: value
    }));
    if (errors.id_entite) {
      setErrors(prev => ({
        ...prev,
        id_entite: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof NatureFluxFormData, string>> = {};

    if (!formData.code) newErrors.code = 'Le code est requis';
    if (!formData.libelle) newErrors.libelle = 'Le libellé est requis';
    if (!formData.id_entite) newErrors.id_entite = 'L\'entité est requise';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(formData);
  };

  const entiteOptions: DropdownOption[] = entites.map(entite => ({
    value: entite.id,
    label: `${entite.code} - ${entite.libelle}`
  }));

  return (
    <Form size={100} columns={2} onSubmit={handleSubmit} className="text-sm">
      <FormField
        label="Entité"
        required
        error={errors.id_entite}
        className="mb-3"
      >
        <Dropdown
          options={entiteOptions}
          value={formData.id_entite}
          onChange={handleEntiteChange}
          label="Sélectionner une entité"
          size="sm"
        />
      </FormField>

      <FormField
        label="Code"
        required
        error={errors.code}
        className="mb-3"
      >
        <FormInput
          name="code"
          value={formData.code}
          onChange={handleInputChange}
          maxLength={12}
          placeholder="12 caractères max"
          className="h-9"
        />
      </FormField>

      <FormField
        label="Libellé"
        required
        error={errors.libelle}
        className="mb-3"
      >
        <FormInput
          name="libelle"
          value={formData.libelle}
          onChange={handleInputChange}
          placeholder="Ex: Exploitation"
          className="h-9"
        />
      </FormField>

      <FormField
        label="Statut"
        className="mb-3"
      >
        <Toggle
          checked={formData.actif}
          onChange={handleToggleChange}
          label={formData.actif ? 'Actif' : 'Inactif'}
          size="sm"
        />
      </FormField>

      <FormField
        label="Description"
        className="mb-3 col-span-2"
      >
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          className="w-full p-2 text-sm border-2 border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
          rows={2}
          placeholder="Description optionnelle de la nature de flux..."
        />
      </FormField>

      <FormActions>
        <Button
          label="Annuler"
          size="sm"
          color="#6B7280"
          onClick={onCancel}
          type="button"
        />
        <Button
          label={isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          size="sm"
          icon="Save"
          color="var(--color-primary)"
          type="submit"
          disabled={isSubmitting}
        />
      </FormActions>
    </Form>
  );
}