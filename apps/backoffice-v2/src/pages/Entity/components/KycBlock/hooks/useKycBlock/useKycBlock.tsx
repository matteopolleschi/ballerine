import { ComponentProps, useCallback } from 'react';
import { isObject, StateTag, TStateTags } from '@ballerine/common';

import { TWorkflowById } from '../../../../../../domains/workflows/fetchers';
import { useStorageFilesQuery } from '../../../../../../domains/storage/hooks/queries/useStorageFilesQuery/useStorageFilesQuery';
import { omitPropsFromObject } from '../../../../hooks/useEntity/utils';
import { capitalize } from '../../../../../../common/utils/capitalize/capitalize';
import { useCaseDecision } from '../../../Case/hooks/useCaseDecision/useCaseDecision';
import { MotionBadge } from '../../../../../../common/components/molecules/MotionBadge/MotionBadge';
import { valueOrNA } from '../../../../../../common/utils/value-or-na/value-or-na';
import { toTitleCase } from 'string-ts';
import { useApproveCaseAndDocumentsMutation } from '@/domains/entities/hooks/mutations/useApproveCaseAndDocumentsMutation/useApproveCaseAndDocumentsMutation';
import { useRevisionCaseAndDocumentsMutation } from '@/domains/entities/hooks/mutations/useRevisionCaseAndDocumentsMutation/useRevisionCaseAndDocumentsMutation';
import { useCaseState } from '@/pages/Entity/components/Case/hooks/useCaseState/useCaseState';
import { useAuthenticatedUserQuery } from '@/domains/auth/hooks/queries/useAuthenticatedUserQuery/useAuthenticatedUserQuery';
import { useWorkflowQuery } from '@/domains/workflows/hooks/queries/useWorkflowQuery/useWorkflowQuery';
import { useFilterId } from '@/common/hooks/useFilterId/useFilterId';

const motionProps: ComponentProps<typeof MotionBadge> = {
  exit: { opacity: 0, transition: { duration: 0.2 } },
  initial: { y: 10, opacity: 0 },
  transition: { type: 'spring', bounce: 0.3 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.2 } },
};

export const useKycBlock = ({
  parentWorkflowId,
  childWorkflow,
}: {
  childWorkflow: TWorkflowById['childWorkflows'][number];
  parentWorkflowId: string;
}) => {
  const { noAction } = useCaseDecision();
  const results: Array<Array<string>> = [];

  const docsData = useStorageFilesQuery(
    childWorkflow?.context?.documents?.flatMap(({ pages }) =>
      pages?.map(({ ballerineFileId }) => ballerineFileId),
    ),
  );

  childWorkflow?.context?.documents?.forEach((document, docIndex) => {
    document?.pages?.forEach((page, pageIndex: number) => {
      if (!results[docIndex]) {
        results[docIndex] = [];
      }
      results[docIndex][pageIndex] = docsData?.shift()?.data;
    });
  });

  const decision = Object.keys(childWorkflow?.context?.pluginsOutput?.kyc_session ?? {})?.length
    ? Object.keys(childWorkflow?.context?.pluginsOutput?.kyc_session ?? {})?.flatMap(key => [
        {
          title: 'Verified With',
          value: capitalize(childWorkflow?.context?.pluginsOutput?.kyc_session[key]?.vendor),
          pattern: '',
          isEditable: false,
          dropdownOptions: undefined,
        },
        {
          title: 'Result',
          value: childWorkflow?.context?.pluginsOutput?.kyc_session[key]?.result?.decision?.status,
          pattern: '',
          isEditable: false,
          dropdownOptions: undefined,
        },
        {
          title: 'Issues',
          value: childWorkflow?.context?.pluginsOutput?.kyc_session[key]?.decision?.riskLabels
            ?.length
            ? childWorkflow?.context?.pluginsOutput?.kyc_session[key]?.decision?.riskLabels?.join(
                ', ',
              )
            : 'none',
          pattern: '',
          isEditable: false,
          dropdownOptions: undefined,
        },
        ...(isObject(childWorkflow?.context?.pluginsOutput?.kyc_session[key])
          ? [
              {
                title: 'Full report',
                value: childWorkflow?.context?.pluginsOutput?.kyc_session[key],
                pattern: '',
                isEditable: false,
                dropdownOptions: undefined,
              },
            ]
          : []),
      ]) ?? []
    : [];

  const documentExtractedData = Object.keys(
    childWorkflow?.context?.pluginsOutput?.kyc_session ?? {},
  )?.length
    ? Object.keys(childWorkflow?.context?.pluginsOutput?.kyc_session ?? {})?.map(
        (key, index, collection) => ({
          id: 'decision',
          type: 'details',
          value: {
            id: childWorkflow?.id,
            title: `Details`,
            hideSeparator: index === collection.length - 1,
            data: Object.entries({
              ...childWorkflow?.context?.pluginsOutput?.kyc_session[key]?.result?.entity?.data,
              ...omitPropsFromObject(
                childWorkflow?.context?.pluginsOutput?.kyc_session[key]?.result?.documents?.[0]
                  ?.properties,
                'issuer',
              ),
              issuer:
                childWorkflow?.context?.pluginsOutput?.kyc_session[key]?.result?.documents?.[0]
                  ?.issuer?.country,
            })?.map(([title, value]) => ({
              title,
              value,
              pattern: '',
              isEditable: false,
              dropdownOptions: undefined,
            })),
          },
          workflowId: childWorkflow?.id,
          documents: childWorkflow?.context?.documents,
        }),
      ) ?? []
    : [];

  const details = Object.entries(childWorkflow?.context?.entity?.data ?? {}).map(
    ([title, value]) => ({
      title,
      value,
      pattern: '',
      isEditable: false,
      dropdownOptions: undefined,
    }),
  );
  const documents = childWorkflow?.context?.documents?.flatMap(
    (document, docIndex) =>
      document?.pages?.map(({ type, metadata, data }, pageIndex) => ({
        title: `${valueOrNA(toTitleCase(document?.category ?? ''))} - ${valueOrNA(
          toTitleCase(document?.type ?? ''),
        )}${metadata?.side ? ` - ${metadata?.side}` : ''}`,
        imageUrl: results[docIndex][pageIndex],
        fileType: type,
      })) ?? [],
  );

  const { mutate: mutateApproveCase, isLoading: isLoadingApproveCase } =
    useApproveCaseAndDocumentsMutation({
      workflowId: childWorkflow?.id,
    });
  const { isLoading: isLoadingRevisionCase } = useRevisionCaseAndDocumentsMutation({
    workflowId: childWorkflow?.id,
  });
  const onMutateApproveCase = useCallback(() => mutateApproveCase(), [mutateApproveCase]);
  const filterId = useFilterId();
  const { data: parentWorkflow } = useWorkflowQuery({
    workflowId: parentWorkflowId,
    filterId,
  });
  const { data: session } = useAuthenticatedUserQuery();
  const caseState = useCaseState(session?.user, parentWorkflow);
  const isDisabled =
    !caseState.actionButtonsEnabled ||
    !childWorkflow?.tags?.includes(StateTag.MANUAL_REVIEW) ||
    noAction ||
    isLoadingApproveCase ||
    isLoadingRevisionCase;

  const getDecisionStatusOrAction = (tags?: TStateTags) => {
    const badgeClassNames = 'text-sm font-bold';

    if (tags?.includes(StateTag.REVISION)) {
      return [
        {
          type: 'badge',
          value: 'Pending re-upload',
          props: {
            ...motionProps,
            variant: 'warning',
            className: badgeClassNames,
          },
        },
      ];
    }

    if (tags?.includes(StateTag.APPROVED)) {
      return [
        {
          type: 'badge',
          value: 'Approved',
          props: {
            ...motionProps,
            variant: 'success',
            className: `${badgeClassNames} bg-success/20`,
          },
        },
      ];
    }

    if (tags?.includes(StateTag.REJECTED)) {
      return [
        {
          type: 'badge',
          value: 'Rejected',
          props: {
            ...motionProps,
            variant: 'destructive',
            className: `${badgeClassNames}`,
          },
        },
      ];
    }

    if (tags?.includes(StateTag.PENDING_PROCESS)) {
      return [
        {
          type: 'badge',
          value: 'Pending ID verification',
          props: {
            ...motionProps,
            variant: 'warning',
            className: `${badgeClassNames}`,
          },
        },
      ];
    }

    return [
      {
        type: 'caseCallToActionLegacy',
        value: 'Re-upload needed',
        data: {
          parentWorkflowId: parentWorkflowId,
          childWorkflowId: childWorkflow?.id,
          childWorkflowContextSchema: childWorkflow?.workflowDefinition?.contextSchema,
          disabled: isDisabled,
        },
      },
      {
        type: 'callToAction',
        value: {
          text: 'Approve',
          onClick: onMutateApproveCase,
          props: {
            disabled: isDisabled,
            size: 'wide',
            variant: 'success',
          },
        },
      },
    ];
  };

  const headerCell = {
    id: 'header',
    type: 'container',
    value: [
      {
        type: 'heading',
        value: `${valueOrNA(childWorkflow?.context?.entity?.data?.firstName)} ${valueOrNA(
          childWorkflow?.context?.entity?.data?.lastName,
        )}`,
      },
      {
        id: 'actions',
        type: 'container',
        value: getDecisionStatusOrAction(childWorkflow?.tags),
      },
    ],
  };

  return {
    className:
      childWorkflow.state === 'revision'
        ? `shadow-[0_4px_4px_0_rgba(174,174,174,0.0625)] border-[1px] border-warning`
        : '',
    cells: [
      [
        headerCell,
        {
          id: 'kyc-block',
          type: 'container',
          value: [
            {
              type: 'container',
              value: [
                {
                  type: 'container',
                  value: [
                    {
                      id: 'header',
                      type: 'heading',
                      value: 'Details',
                    },
                    {
                      id: 'decision',
                      type: 'details',
                      value: {
                        id: 1,
                        title: `Details`,
                        data: details,
                      },
                      workflowId: childWorkflow?.id,
                      documents: childWorkflow?.context?.documents,
                    },
                  ],
                },
                {
                  type: 'container',
                  value: [
                    {
                      id: 'header',
                      type: 'heading',
                      value: 'Document Extracted Data',
                    },
                    ...documentExtractedData,
                  ],
                },
                {
                  type: 'container',
                  value: [
                    {
                      id: 'header',
                      type: 'heading',
                      value: 'Document Verification Results',
                    },
                    {
                      id: 'decision',
                      type: 'details',
                      hideSeparator: true,
                      value: {
                        id: 1,
                        title: `Decision`,
                        data: decision,
                      },
                      workflowId: childWorkflow?.id,
                      documents: childWorkflow?.context?.documents,
                    },
                  ],
                },
              ],
            },
            {
              type: 'multiDocuments',
              value: {
                isLoading: docsData?.some(({ isLoading }) => isLoading),
                data: documents,
              },
            },
          ],
        },
      ],
    ],
  };
};
