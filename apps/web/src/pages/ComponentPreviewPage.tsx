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
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Component Library</h1>
          <p className="text-lg text-slate-600">
            Reusable UI components built with React, TypeScript, and Tailwind CSS
          </p>
        </div>

        {/* Buttons Section */}
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-slate-900">Buttons</h2>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Variants */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Variants</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>
              </div>

              {/* Sizes */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Sizes</h3>
                <div className="flex flex-wrap gap-3 items-center">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>

              {/* States */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">States</h3>
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
              <h2 className="text-2xl font-bold text-slate-900">Form Inputs</h2>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Text Input */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Text Input</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Input Sizes</h3>
                <div className="space-y-4">
                  <Input size="sm" placeholder="Small input..." label="Small" />
                  <Input size="md" placeholder="Medium input..." label="Medium" />
                  <Input size="lg" placeholder="Large input..." label="Large" />
                </div>
              </div>

              {/* Select */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Select</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Date Picker</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <h2 className="text-2xl font-bold text-slate-900">Cards</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card hoverable>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Hoverable Card</h3>
                  </CardHeader>
                  <CardBody>
                    <p className="text-slate-600">This card has hover effects.</p>
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
                    <p className="text-slate-600">This card uses shadow instead of border.</p>
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
              <h2 className="text-2xl font-bold text-slate-900">Modal</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
                <p className="text-slate-600 text-sm">Click the button to see the modal.</p>
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
              <p className="text-slate-600 mb-4">
                This is a reusable modal component. It supports custom sizes, titles, and
                footer actions.
              </p>
              <p className="text-slate-600">Press Escape to close or click the X button.</p>
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
              <h2 className="text-2xl font-bold text-slate-900">Table</h2>
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
              <h2 className="text-2xl font-bold text-slate-900">Pagination</h2>
            </CardHeader>
            <CardBody className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Default</h3>
                <Pagination
                  currentPage={currentPage}
                  totalPages={10}
                  onPageChange={setCurrentPage}
                />
              </div>
              <p className="text-sm text-slate-600">Current page: {currentPage}</p>
            </CardBody>
          </Card>
        </section>

        {/* Summary */}
        <section className="space-y-6">
          <Card className="bg-teal-50 border-teal-200">
            <CardBody>
              <h2 className="text-2xl font-bold text-teal-900 mb-4">Component Library Summary</h2>
              <ul className="space-y-2 text-teal-800">
                <li>✓ 7 component categories implemented</li>
                <li>✓ Built with TypeScript for type safety</li>
                <li>✓ Tailwind CSS for consistent styling</li>
                <li>✓ Reusable variants and sizes</li>
                <li>✓ Responsive design built in</li>
                <li>✓ Accessibility features included</li>
                <li>✓ Preview page for component testing</li>
              </ul>
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default ComponentPreviewPage;
