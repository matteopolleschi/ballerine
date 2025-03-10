import { ICallToActionDocumentSelection } from '@/pages/Entity/components/DirectorsCallToAction/interfaces';
import { TWorkflowById } from '@/domains/workflows/fetchers';

export interface ICallToActionLegacyProps {
  value: {
    text: string;
    props: {
      id: string;
      workflow: TWorkflowById;
      disabled: boolean;
      decision: 'reject' | 'approve' | 'revision' | 'revised';
      documentSelection?: ICallToActionDocumentSelection;
      contextUpdateMethod?: 'base' | 'director';
      revisionReasons?: string[];
      rejectionReasons?: string[];
      onReuploadReset?: () => void;
      onDialogClose?: () => void;
    };
  };
}
