import Layout from '../../components/Layout';
import BrandLoader from '../../components/BrandLoader';
import ProgressPage, { progressSeo } from '../../components/progress/ProgressPage';
import { useMemberData } from '../../utils/use-member-data';

export default function MyProgress() {
  const { data, loading, error } = useMemberData('/api/progress');
  if (error || loading || !data) {
    return <Layout>{progressSeo}<div className="member-page">{error ? <p className="onboarding-error" role="alert">{error}</p> : <BrandLoader label="Loading your progress…" />}</div></Layout>;
  }
  return <ProgressPage initial={data} />;
}
