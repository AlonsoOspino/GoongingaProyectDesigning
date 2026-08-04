import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { clsx } from "clsx";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table
        ref={ref}
        className={clsx("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
);

Table.displayName = "Table";

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={clsx("bg-surface border-b border-border", className)}
    {...props}
  />
));

TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={clsx("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));

TableBody.displayName = "TableBody";

export const TableRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={clsx(
      "border-b border-border transition-colors hover:bg-surface-elevated/50",
      className
    )}
    {...props}
  />
));

TableRow.displayName = "TableRow";

interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sorted?: "asc" | "desc" | false;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable, sorted, children, ...props }, ref) => (
    <th
      ref={ref}
      className={clsx(
        "h-10 px-4 text-left align-middle font-medium text-muted",
        sortable && "cursor-pointer select-none hover:text-foreground",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && sorted && (
          <svg
            className={clsx("w-4 h-4", sorted === "desc" && "rotate-180")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        )}
      </div>
    </th>
  )
);

TableHead.displayName = "TableHead";

export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={clsx("px-4 py-3 align-middle text-foreground", className)}
    {...props}
  />
));

TableCell.displayName = "TableCell";
