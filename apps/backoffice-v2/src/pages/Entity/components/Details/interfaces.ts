import { IEditableDetailsDocument } from '@/pages/Entity/components/EditableDetails/interfaces';
import { AnyObject } from '@ballerine/ui';

export interface IDetailsProps {
  id: string;
  workflowId: string;
  hideSeparator?: boolean;
  documents?: IEditableDetailsDocument[];
  contextUpdateMethod?: 'base' | 'director';
  value: {
    id: string;
    title: string;
    subtitle: string;
    data: Array<{
      title: string;
      isEditable: boolean;
      type: string;
      format?: string;
      pattern?: string;
      value: unknown;
      dropdownOptions?: Array<{ label: string; value: string }>;
      dependantOn?: string;
      dependantValue?: string;
      minimum?: string;
      maximum?: string;
    }>;
  };
  onSubmit?: (document: AnyObject) => void;
}
