import PageHeader from "@/components/ui/PageHeader";
import ImportWizard from "./ImportWizard";

export default function ImportEmployeesPage() {
  return (
    <div>
      <PageHeader title="استيراد الموظفين من Excel" description="لا يتم استيراد أي صف بحالة خطأ تلقائيًا." />
      <ImportWizard />
    </div>
  );
}
