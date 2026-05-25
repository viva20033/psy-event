export interface AdminSectionProps {
  showMessage: (text: string) => void;
  showError: (text: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}
