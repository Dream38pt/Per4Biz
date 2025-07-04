import React, { useEffect, useState } from 'react';
import { useMenu } from '../../context/MenuContext';
import { useProfil } from '../../context/ProfilContext';
import { supabase } from '../../lib/supabase';
import { menuItemsGestionRH } from '../../config/menuConfig';
import { PageSection } from '../../components/ui/page-section';
import { DataTable, Column } from '../../components/ui/data-table';
import { Button } from '../../components/ui/button';
import { ToastContainer, ToastData } from '../../components/ui/toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import styles from './styles.module.css';
import FichePersonnel from './FichePersonnel';

interface Personnel {
  id: string;
  nom: string;
  prenom: string;
  code_court: string;
  matricule: string;
  civilite: string | null;
  sexe: string | null;
  date_naissance: string | null;
  email_perso: string | null;
  telephone: string | null;
  actif: boolean;
  created_at: string;
  tiers: {
    code: string;
    nom: string;
  };
}

const MesEmployes: React.FC = () => {
  const { setMenuItems } = useMenu();
  const { profil, loading: profilLoading } = useProfil();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // État pour la fiche personnel
  const [showFichePersonnel, setShowFichePersonnel] = useState(false);
  const [ficheMode, setFicheMode] = useState<'create' | 'edit'>('create');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setMenuItems(menuItemsGestionRH);
    if (!profilLoading) {
      fetchPersonnel();
    }
  }, [setMenuItems, profilLoading, profil?.com_contrat_client_id]);

  const fetchPersonnel = async () => {
    try {
      if (!profil?.com_contrat_client_id) {
        setPersonnel([]);
        return;
      }

      const { data, error } = await supabase
        .from('rh_personnel')
        .select(`
          *,
          tiers:id_tiers (
            code,
            nom
          )
        `)
        .eq('com_contrat_client_id', profil.com_contrat_client_id)
        .order('nom');

      if (error) throw error;
      setPersonnel(data || []);
    } catch (error) {
      console.error('Erreur lors de la récupération du personnel:', error);
      addToast({
        label: 'Erreur lors de la récupération du personnel',
        icon: 'AlertTriangle',
        color: '#ef4444'
      });
    } finally {
      setLoading(false);
    }
  };

  const addToast = (toast: Omit<ToastData, 'id'>) => {
    const newToast: ToastData = {
      ...toast,
      id: Date.now().toString(),
    };
    setToasts(prev => [...prev, newToast]);
  };

  const closeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Ouvrir la fiche personnel en mode édition
  const handleEdit = (personnel: Personnel) => {
    setSelectedPersonnelId(personnel.id);
    setFicheMode('edit');
    setShowFichePersonnel(true);
  };

  // Ouvrir la fiche personnel en mode création
  const handleCreate = () => {
    setSelectedPersonnelId(undefined);
    setFicheMode('create');
    setShowFichePersonnel(true);
  };

  // Fermer la fiche personnel et rafraîchir les données
  const handleCloseFiche = () => {
    setShowFichePersonnel(false);
    fetchPersonnel();
  };

  const handleDelete = async (personne: Personnel) => {
    if (window.confirm(`Êtes-vous sûr de vouloir désactiver ${personne.prenom} ${personne.nom} ?`)) {
      try {
        // Supprimer d'abord les pièces jointes
        const { error: piecesJointesError } = await supabase
          .from('rh_piece_jointe')
          .delete()
          .eq('id_personnel', personne.id);

        if (piecesJointesError) {
          console.error('Erreur lors de la suppression des pièces jointes:', piecesJointesError);
        }

        // Supprimer les coûts mensuels
        const { error: coutsMensuelsError } = await supabase
          .from('rh_cout_mensuel')
          .delete()
          .eq('id_personnel', personne.id);

        if (coutsMensuelsError) {
          console.error('Erreur lors de la suppression des coûts mensuels:', coutsMensuelsError);
        }

        // Supprimer l'historique financier
        const { error: historiqueFinancierError } = await supabase
          .from('rh_historique_financier')
          .delete()
          .eq('id_personnel', personne.id);

        if (historiqueFinancierError) {
          console.error('Erreur lors de la suppression de l\'historique financier:', historiqueFinancierError);
        }

        // Récupérer les IDs des contrats pour pouvoir supprimer les affectations
        const { data: contrats, error: contratsError } = await supabase
          .from('rh_historique_contrat')
          .select('id')
          .eq('id_personnel', personne.id);

        if (contratsError) {
          console.error('Erreur lors de la récupération des contrats:', contratsError);
        } else if (contrats && contrats.length > 0) {
          const contratIds = contrats.map(c => c.id);
          
          // Supprimer les affectations liées aux contrats
          const { error: affectationsError } = await supabase
            .from('rh_affectation')
            .delete()
            .in('id_contrat', contratIds);

          if (affectationsError) {
            console.error('Erreur lors de la suppression des affectations:', affectationsError);
          }
        }

        // Supprimer les contrats
        const { error: contratsDeleteError } = await supabase
          .from('rh_historique_contrat')
          .delete()
          .eq('id_personnel', personne.id);

        if (contratsDeleteError) {
          console.error('Erreur lors de la suppression des contrats:', contratsDeleteError);
        }

        // Enfin, supprimer le personnel lui-même
        const { error } = await supabase
          .from('rh_personnel')
          .delete()
          .eq('id', personne.id);

        if (error) throw error;

        await fetchPersonnel();
        addToast({
          label: `${personne.prenom} ${personne.nom} a été supprimé avec succès`,
          icon: 'Check',
          color: '#22c55e'
        });
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        
        // Message d'erreur plus convivial en cas d'échec
        let errorMessage = 'Erreur lors de la suppression de l\'employé';
        
        // Vérifier si l'erreur est due à une contrainte de clé étrangère
        if (error.message?.includes('foreign key constraint') || 
            error.message?.includes('violates foreign key constraint')) {
          errorMessage = `Impossible de supprimer ${personne.prenom} ${personne.nom} car il est référencé dans d'autres parties de l'application. Veuillez le désactiver plutôt que le supprimer.`;
        }
        
        addToast({
          label: errorMessage,
          icon: 'AlertTriangle',
          color: '#ef4444'
        });
      }
    }
  };

  // Si la fiche personnel est affichée, montrer uniquement celle-ci
  if (showFichePersonnel) {
    return (
      <FichePersonnel 
        mode={ficheMode} 
        id={selectedPersonnelId} 
        onClose={handleCloseFiche} 
      />
    );
  }

  const columns: Column<Personnel>[] = [
    {
      label: 'Code',
      accessor: 'code_court',
      sortable: true
    },
    {
      label: 'Matricule',
      accessor: 'matricule',
      sortable: true
    },
    {
      label: 'Nom',
      accessor: 'nom',
      sortable: true,
      render: (value, row) => `${row.prenom} ${value}`
    },
    {
      label: 'Civilité',
      accessor: 'civilite',
      render: (value) => value || '-'
    },
    {
      label: 'Email',
      accessor: 'email_perso',
      render: (value) => value || '-'
    },
    {
      label: 'Téléphone',
      accessor: 'telephone',
      render: (value) => value || '-'
    },
    {
      label: 'Actif',
      accessor: 'actif',
      align: 'center',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Oui' : 'Non'}
        </span>
      )
    },
    {
      label: 'Date de création',
      accessor: 'created_at',
      render: (value) => format(new Date(value), 'dd/MM/yyyy', { locale: fr })
    }
  ];

  const actions = [
    {
      label: 'Éditer',
      icon: 'edit',
      color: 'var(--color-primary)',
      onClick: handleEdit
    },
    {
      label: 'Supprimer',
      icon: 'delete',
      color: '#ef4444',
      onClick: handleDelete
    }
  ];

  return (
    <div className={styles.container}>
      <PageSection
        title={loading || profilLoading ? "Chargement..." : "Mes Employés"}
        description="Gérez les employés de votre organisation. La suppression est définitive et supprime toutes les données associées."
        className={styles.header}
      >
        <div className="mb-6">
          <Button
            label="Ajouter un employé"
            icon="UserPlus"
            color="var(--color-primary)" 
            onClick={handleCreate}
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">Chargement des employés...</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={personnel}
            onRowClick={handleEdit}
            actions={actions}
            defaultRowsPerPage={10}
            emptyTitle="Aucun employé"
            emptyMessage="Aucun employé n'a été créé pour le moment."
          />
        )}

        <ToastContainer toasts={toasts} onClose={closeToast} />
      </PageSection>
    </div>
  );
};
export default MesEmployes;