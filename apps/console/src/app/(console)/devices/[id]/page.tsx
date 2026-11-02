'use client';

import { useParams } from 'next/navigation';
import { DeviceDetail } from '@/components/views';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <DeviceDetail id={params.id} />;
}
