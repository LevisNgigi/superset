/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { t, SupersetClient } from '@superset-ui/core';
import { useMemo, useState } from 'react';
import { ConfirmStatusChange, Tooltip } from '@superset-ui/core/components';
import {
  ModifiedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilters,
  type ListViewFetchDataConfig as FetchDataConfig,
} from 'src/components';
import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import rison from 'rison';
import { useListViewResource } from 'src/views/CRUD/hooks';
import RowLevelSecurityModal from 'src/features/rls/RowLevelSecurityModal';
import { RLSObject } from 'src/features/rls/types';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import { QueryObjectColumns } from 'src/views/CRUD/types';

interface RLSProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function RowLevelSecurityList(props: RLSProps) {
  const { addDangerToast, addSuccessToast, user } = props;
  const [ruleModalOpen, setRuleModalOpen] = useState<boolean>(false);
  const [currentRule, setCurrentRule] = useState(null);

  const {
    state: {
      loading,
      resourceCount: rulesCount,
      resourceCollection: rules,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<RLSObject>(
    'rowlevelsecurity',
    t('Row Level Security'),
    addDangerToast,
    true,
    undefined,
    undefined,
    true,
  );

  function handleRuleEdit(rule: null) {
    setCurrentRule(rule);
    setRuleModalOpen(true);
  }

  function handleRuleDelete(
    { id, name }: RLSObject,
    refreshData: (arg0?: FetchDataConfig | null) => void,
    addSuccessToast: (arg0: string) => void,
    addDangerToast: (arg0: string) => void,
  ) {
    return SupersetClient.delete({
      endpoint: `/api/v1/rowlevelsecurity/${id}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t('Deleted %s', name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', name, errMsg)),
      ),
    );
  }
  function handleBulkRulesDelete(rulesToDelete: RLSObject[]) {
    const ids = rulesToDelete.map(({ id }) => id);
    return SupersetClient.delete({
      endpoint: `/api/v1/rowlevelsecurity/?q=${rison.encode(ids)}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t(`Deleted`));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting rules: %s', errMsg)),
      ),
    );
  }

  function handleRuleModalHide() {
    setCurrentRule(null);
    setRuleModalOpen(false);
    refreshData();
  }

  const canWrite = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canExport = hasPerm('can_export');

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        id: 'name',
      },
      {
        accessor: 'filter_type',
        Header: t('Filter Type'),
        size: 'xl',
        id: 'filter_type',
      },
      {
        accessor: 'group_key',
        Header: t('Group Key'),
        size: 'xl',
        id: 'group_key',
      },
      {
        accessor: 'clause',
        Header: t('Clause'),
        id: 'clause',
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: any) => <ModifiedInfo date={changedOn} user={changedBy} />,
        Header: t('Last modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
        id: 'changed_on_delta_humanized',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () =>
            handleRuleDelete(
              original,
              refreshData,
              addSuccessToast,
              addDangerToast,
            );
          const handleEdit = () => handleRuleEdit(original);
          return (
            <div className="actions">
              {canWrite && (
                <ConfirmStatusChange
                  title={t('Please confirm')}
                  description={
                    <>
                      {t('Are you sure you want to delete')}{' '}
                      <b>{original.name}</b>
                    </>
                  }
                  onConfirm={handleDelete}
                >
                  {confirmDelete => (
                    <Tooltip
                      id="delete-action-tooltip"
                      title={t('Delete')}
                      placement="bottom"
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        className="action-button"
                        onClick={confirmDelete}
                      >
                        <Icons.DeleteOutlined
                          data-test="rls-list-trash-icon"
                          iconSize="l"
                        />
                      </span>
                    </Tooltip>
                  )}
                </ConfirmStatusChange>
              )}
              {canEdit && (
                <Tooltip
                  id="edit-action-tooltip"
                  title={t('Edit')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleEdit}
                  >
                    <Icons.EditOutlined data-test="edit-alt" iconSize="l" />
                  </span>
                </Tooltip>
              )}
            </div>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canWrite && !canExport,
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
        id: QueryObjectColumns.ChangedBy,
      },
    ],
    [
      user.userId,
      canEdit,
      canWrite,
      canExport,
      hasPerm,
      refreshData,
      addDangerToast,
      addSuccessToast,
    ],
  );

  const emptyState = {
    title: t('No Rules yet'),
    image: 'filter-results.svg',
    buttonAction: () => handleRuleEdit(null),
    buttonIcon: canEdit ? (
      <Icons.PlusOutlined iconSize="m" data-test="add-rule-empty" />
    ) : undefined,
    buttonText: canEdit ? t('Rule') : null,
  };

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'name',
        input: 'search',
        operator: FilterOperator.StartsWith,
      },
      {
        Header: t('Filter Type'),
        key: 'filter_type',
        id: 'filter_type',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Regular'), value: 'Regular' },
          { label: t('Base'), value: 'Base' },
        ],
      },
      {
        Header: t('Group Key'),
        key: 'search',
        id: 'group_key',
        input: 'search',
        operator: FilterOperator.StartsWith,
      },
      {
        Header: t('Modified by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'rowlevelsecurity',
          'changed_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset datasource values: %s',
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
      },
    ],
    [user],
  );

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
  const PAGE_SIZE = 25;

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canWrite) {
    subMenuButtons.push({
      name: t('Rule'),
      icon: <Icons.PlusOutlined iconSize="m" data-test="add-rule" />,
      buttonStyle: 'primary',
      onClick: () => handleRuleEdit(null),
    });
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      'data-test': 'bulk-select',
      onClick: toggleBulkSelect,
    });
  }

  return (
    <>
      <SubMenu name={t('Row Level Security')} buttons={subMenuButtons} />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected rules?')}
        onConfirm={handleBulkRulesDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canWrite) {
            bulkActions.push({
              key: 'delete',
              name: t('Delete'),
              type: 'danger',
              onSelect: confirmDelete,
            });
          }
          return (
            <>
              <RowLevelSecurityModal
                rule={currentRule}
                addDangerToast={addDangerToast}
                onHide={handleRuleModalHide}
                addSuccessToast={addSuccessToast}
                show={ruleModalOpen}
              />
              <ListView<RLSObject>
                className="rls-list-view"
                bulkActions={bulkActions}
                bulkSelectEnabled={bulkSelectEnabled}
                disableBulkSelect={toggleBulkSelect}
                columns={columns}
                count={rulesCount}
                data={rules}
                emptyState={emptyState}
                fetchData={fetchData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                addDangerToast={addDangerToast}
                addSuccessToast={addSuccessToast}
                refreshData={() => {}}
                pageSize={PAGE_SIZE}
              />
            </>
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(RowLevelSecurityList);
