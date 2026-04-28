/**
 * Unit Tests for AdminDataTable
 *
 * Tests column rendering, sorting click, pagination prev/next,
 * empty state, row click handler, and loading state.
 *
 * _Requirements: 26.2_
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminDataTable, type AdminDataTableColumn } from '../AdminDataTable';

interface TestRow {
  id: number;
  name: string;
  score: number;
  [key: string]: unknown;
}

const columns: AdminDataTableColumn<TestRow>[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'score', label: 'Score', sortable: true, align: 'right' },
];

const sampleData: TestRow[] = [
  { id: 1, name: 'Alice', score: 95 },
  { id: 2, name: 'Bob', score: 87 },
  { id: 3, name: 'Charlie', score: 72 },
];

describe('AdminDataTable', () => {
  describe('column rendering', () => {
    it('should render column headers', () => {
      render(<AdminDataTable columns={columns} data={sampleData} />);

      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
    });

    it('should render row data using default key access', () => {
      render(<AdminDataTable columns={columns} data={sampleData} />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument();
    });

    it('should render row data using custom render function', () => {
      const customColumns: AdminDataTableColumn<TestRow>[] = [
        {
          key: 'name',
          label: 'Player',
          render: (row) => <strong data-testid={`player-${row.id}`}>{row.name}</strong>,
        },
      ];

      render(<AdminDataTable columns={customColumns} data={sampleData} />);

      expect(screen.getByTestId('player-1')).toHaveTextContent('Alice');
      expect(screen.getByTestId('player-2')).toHaveTextContent('Bob');
    });
  });

  describe('sorting', () => {
    it('should call onSort when a sortable column header is clicked', () => {
      const onSort = vi.fn();

      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          onSort={onSort}
          sortState={{ key: 'name', direction: 'asc' }}
        />,
      );

      fireEvent.click(screen.getByText('Name'));
      expect(onSort).toHaveBeenCalledWith('name');
    });

    it('should not call onSort when a non-sortable column header is clicked', () => {
      const onSort = vi.fn();

      render(
        <AdminDataTable columns={columns} data={sampleData} onSort={onSort} />,
      );

      fireEvent.click(screen.getByText('ID'));
      expect(onSort).not.toHaveBeenCalled();
    });

    it('should display ascending sort indicator for sorted column', () => {
      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          sortState={{ key: 'name', direction: 'asc' }}
        />,
      );

      expect(screen.getByLabelText('sorted ascending')).toBeInTheDocument();
    });

    it('should display descending sort indicator for sorted column', () => {
      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          sortState={{ key: 'name', direction: 'desc' }}
        />,
      );

      expect(screen.getByLabelText('sorted descending')).toBeInTheDocument();
    });

    it('should set aria-sort attribute on sorted column header', () => {
      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          sortState={{ key: 'name', direction: 'asc' }}
        />,
      );

      const nameHeader = screen.getByText('Name').closest('th');
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    });
  });

  describe('pagination', () => {
    it('should render pagination controls when pagination is provided', () => {
      const onPageChange = vi.fn();

      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          pagination={{ page: 2, totalPages: 5, onPageChange }}
        />,
      );

      expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
      expect(screen.getByText('Prev')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('should call onPageChange with previous page when Prev is clicked', () => {
      const onPageChange = vi.fn();

      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          pagination={{ page: 3, totalPages: 5, onPageChange }}
        />,
      );

      fireEvent.click(screen.getByText('Prev'));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange with next page when Next is clicked', () => {
      const onPageChange = vi.fn();

      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          pagination={{ page: 3, totalPages: 5, onPageChange }}
        />,
      );

      fireEvent.click(screen.getByText('Next'));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('should disable Prev button on first page', () => {
      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          pagination={{ page: 1, totalPages: 5, onPageChange: vi.fn() }}
        />,
      );

      expect(screen.getByText('Prev')).toBeDisabled();
    });

    it('should disable Next button on last page', () => {
      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          pagination={{ page: 5, totalPages: 5, onPageChange: vi.fn() }}
        />,
      );

      expect(screen.getByText('Next')).toBeDisabled();
    });

    it('should not render pagination when totalPages is 1', () => {
      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          pagination={{ page: 1, totalPages: 1, onPageChange: vi.fn() }}
        />,
      );

      expect(screen.queryByText('Prev')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should render default empty message when data is empty', () => {
      render(<AdminDataTable columns={columns} data={[]} />);

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should render custom empty message when provided', () => {
      render(
        <AdminDataTable
          columns={columns}
          data={[]}
          emptyMessage="No players found"
        />,
      );

      expect(screen.getByText('No players found')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should render loading indicator when loading is true', () => {
      render(<AdminDataTable columns={columns} data={[]} loading />);

      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('should not render table when loading', () => {
      render(<AdminDataTable columns={columns} data={sampleData} loading />);

      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });
  });

  describe('row click', () => {
    it('should call onRowClick when a row is clicked', () => {
      const onRowClick = vi.fn();

      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          onRowClick={onRowClick}
        />,
      );

      fireEvent.click(screen.getByText('Alice'));
      expect(onRowClick).toHaveBeenCalledWith(sampleData[0]);
    });

    it('should apply cursor-pointer class when onRowClick is provided', () => {
      const onRowClick = vi.fn();

      render(
        <AdminDataTable
          columns={columns}
          data={sampleData}
          onRowClick={onRowClick}
        />,
      );

      const row = screen.getByText('Alice').closest('tr');
      expect(row?.className).toContain('cursor-pointer');
    });
  });
});
