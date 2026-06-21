import { useEffect, useMemo, useState } from 'react';
import Alert from '../components/Alert';
import { Plus, Edit2, Trash2, Search } from '../components/Icons';

const defaultCategories = [
  { id: 1, name: 'Antibiotics', description: 'Medicines used to treat bacterial infections.', medicines_count: 24 },
  { id: 2, name: 'Pain relief', description: 'Medicines for fever, pain, and body aches.', medicines_count: 18 },
  { id: 3, name: 'Allergy care', description: 'Medicines for cold, cough, and allergy symptoms.', medicines_count: 15 },
  { id: 4, name: 'Heart care', description: 'Medicines for blood pressure and cardiac support.', medicines_count: 22 },
  { id: 5, name: 'Digestion', description: 'Medicines for stomach, acid, and digestion issues.', medicines_count: 12 },
];

const emptyForm = { name: '', description: '' };

export function Categories() {
  const [categories, setCategories] = useState(defaultCategories);
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    document.title = 'Categories - MediStock';
  }, []);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((category) => [category.name, category.description].join(' ').toLowerCase().includes(term));
  }, [categories, search]);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (category) => {
    setEditingId(category.id);
    setFormData({ name: category.name, description: category.description });
    setShowModal(true);
  };

  const saveCategory = () => {
    if (!formData.name.trim()) {
      setNotification('Category name is required.');
      return;
    }

    if (editingId) {
      setCategories((current) => current.map((category) => (category.id === editingId ? { ...category, ...formData } : category)));
      setNotification('Category updated successfully.');
    } else {
      const nextId = Math.max(...categories.map((category) => category.id), 0) + 1;
      setCategories((current) => [{ id: nextId, ...formData, medicines_count: 0 }, ...current]);
      setNotification('Category created successfully.');
    }

    setShowModal(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const deleteCategory = (id) => {
    if (window.confirm('Delete this category?')) {
      setCategories((current) => current.filter((category) => category.id !== id));
      setNotification('Category removed.');
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Categories</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">Medicine categories</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Categories are written in plain language so both pharmacists and general users can understand what each group means.
            </p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add category
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Total categories</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{categories.length}</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Most stocked</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{Math.max(...categories.map((category) => category.medicines_count), 0)}</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Easy labels</p>
          <p className="mt-3 text-sm text-muted-foreground">Names written in plain pharmacy language.</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Search categories</h2>
            <p className="mt-2 text-sm text-muted-foreground">Use the search box to find a medicine group quickly.</p>
          </div>
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {notification && <div className="mt-4"><Alert type="success">{notification}</Alert></div>}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filteredCategories.map((category) => (
            <div key={category.id} className="rounded-3xl border border-border bg-background p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{category.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(category)} className="rounded-2xl border border-border p-2 text-muted-foreground hover:bg-primary/5" title="Edit category">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteCategory(category.id)} className="rounded-2xl border border-border p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" title="Delete category">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-muted-foreground">
                <strong className="text-foreground">{category.medicines_count}</strong> medicines are grouped here.
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground lg:col-span-2">
              No categories found.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">What each category means</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <div key={`plain-${category.id}`} className="rounded-3xl border border-border bg-slate-50 p-5">
              <p className="text-sm font-semibold text-foreground">{category.name}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{category.description}</p>
            </div>
          ))}
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-foreground">{editingId ? 'Edit category' : 'Add category'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Keep the name short and use a plain description for easy understanding.</p>

            <div className="mt-6 space-y-4">
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Category name"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              />
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Simple description"
                rows={4}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/5">
                Cancel
              </button>
              <button onClick={saveCategory} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90">
                {editingId ? 'Update category' : 'Save category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categories;
