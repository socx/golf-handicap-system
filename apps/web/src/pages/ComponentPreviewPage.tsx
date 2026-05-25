import React, { useState } from 'react';
import {
  Button,
  Input,
  Select,
  DatePicker,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Modal,
  ModalBody,
  ModalFooter,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Pagination,
} from '../components/ui';
import { toast } from '../lib/toast';

const mockTableData = [
  { id: 1, name: 'John Doe', club: 'Royal Golf Club', handicap: 12 },
  { id: 2, name: 'Jane Smith', club: 'Sunset Golf', handicap: 8 },
  { id: 3, name: 'Bob Johnson', club: 'Mountain View', handicap: 15 },
  { id: 4, name: 'Alice Brown', club: 'Coastal Course', handicap: 10 },
  { id: 5, name: 'Charlie Wilson', club: 'Pine Forest', handicap: 18 },
];

export const ComponentPreviewPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [dateValue, setDateValue] = useState('');

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12 transition-colors duration-300 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-4xl font-bold text-slate-900 dark:text-slate-100">Component Library</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Reusable UI components built with React, TypeScript, and Tailwind CSS
          </p>
        </div>

        {/* Toast Section */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Toast Notifications</h2>
            </CardHeader>
            <CardBody className="space-y-6">
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-200">Variants</h3>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => toast.info('Heads up', 'Info notifications are announced politely and dismiss automatically.')}
                    variant="secondary"
                  >
                    Show Info
                  </Button>
                  <Button
                    onClick={() => toast.success('Saved', 'Changes were applied successfully and the message will auto-dismiss.')}
                    variant="primary"
                  >
                    Show Success
                  </Button>
                  <Button
                    onClick={() => toast.warning('Check this', 'Warning notifications use assertive announcement and can be closed manually.')}
                    variant="ghost"
                  >
                    Show Warning
                  </Button>
                  <Button
                    onClick={() => toast.error('Action failed', 'Error notifications are reusable across the app through the shared toast helper.')}
                    variant="danger"
                  >
                    Show Error
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                Toasts support four variants, automatic dismissal, manual close buttons, and ARIA status or alert semantics depending on severity.
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Buttons Section */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Buttons</h2>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Variants */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-200">Variants</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>
              </div>

              {/* Sizes */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-200">Sizes</h3>
                <div className="flex flex-wrap gap-3 items-center">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>

              {/* States */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-200">States</h3>
                <div className="flex flex-wrap gap-3">
                  <Button disabled>Disabled</Button>
                  <Button isLoading>Loading</Button>
                  <Button fullWidth>Full Width</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Form Inputs Section */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Form Inputs</h2>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Text Input */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-200">Text Input</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Standard Input"
                    placeholder="Enter text..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                  <Input
                    label="With Error"
                    placeholder="Enter text..."
                    error="This field is required"
                  />
                </div>
              </div>

              {/* Input Sizes */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-200">Input Sizes</h3>
                <div className="space-y-4">
                  <Input size="sm" placeholder="Small input..." label="Small" />
                  <Input size="md" placeholder="Medium input..." label="Medium" />
                  <Input size="lg" placeholder="Large input..." label="Large" />
                </div>
              </div>

              {/* Select */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-200">Select</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Gender"
                    options={genderOptions}
                    placeholder="Select gender..."
                    value={selectValue}
                    onChange={(e) => setSelectValue(e.target.value)}
                  />
                  <Select
                    label="With Error"
                    options={genderOptions}
                    error="Please select an option"
                  />
                </div>
              </div>

              {/* Date Picker */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-200">Date Picker</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DatePicker
                    label="Birth Date"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                  />
                  <DatePicker
                    label="With Constraints"
                    min="2000-01-01"
                    max="2025-12-31"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Cards Section */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cards</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Card hoverable>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Hoverable Card</h3>
                  </CardHeader>
                  <CardBody>
                    <p className="text-slate-600 dark:text-slate-300">This card has hover effects.</p>
                  </CardBody>
                  <CardFooter>
                    <Button variant="ghost" size="sm">
                      Learn More
                    </Button>
                  </CardFooter>
                </Card>

                <Card border={false} className="shadow-lg">
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Elevated Card</h3>
                  </CardHeader>
                  <CardBody>
                    <p className="text-slate-600 dark:text-slate-300">This card uses shadow instead of border.</p>
                  </CardBody>
                </Card>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Modal Section */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Modal</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
                <p className="text-sm text-slate-600 dark:text-slate-300">Click the button to see the modal.</p>
              </div>
            </CardBody>
          </Card>

          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example Modal"
            size="md"
          >
            <ModalBody>
              <p className="mb-4 text-slate-600 dark:text-slate-300">
                This is a reusable modal component. It supports custom sizes, titles, and
                footer actions.
              </p>
              <p className="text-slate-600 dark:text-slate-300">Press Escape to close or click the X button.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Confirm
              </Button>
            </ModalFooter>
          </Modal>
        </section>

        {/* Table Section */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Table</h2>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Club</TableHeaderCell>
                    <TableHeaderCell>Handicap</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockTableData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.club}</TableCell>
                      <TableCell>{row.handicap}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </section>

        {/* Pagination Section */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pagination</h2>
            </CardHeader>
            <CardBody className="space-y-8">
              <div>
                <h3 className="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-200">Default</h3>
                <Pagination
                  currentPage={currentPage}
                  totalPages={10}
                  onPageChange={setCurrentPage}
                />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">Current page: {currentPage}</p>
            </CardBody>
          </Card>
        </section>

        {/* Summary */}
        <section className="space-y-6">
          <Card className="border-teal-200 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30">
            <CardBody>
              <h2 className="mb-4 text-2xl font-bold text-teal-900 dark:text-teal-200">Component Library Summary</h2>
              <ul className="space-y-2 text-teal-800 dark:text-teal-100">
                <li>✓ 7 component categories implemented</li>
                <li>✓ Built with TypeScript for type safety</li>
                <li>✓ Tailwind CSS for consistent styling</li>
                <li>✓ Reusable variants and sizes</li>
                <li>✓ Responsive design built in</li>
                <li>✓ Accessibility features included</li>
                <li>✓ Preview page for component testing</li>
                <li>✓ Toast notifications cover success, error, warning, and info</li>
              </ul>
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default ComponentPreviewPage;
