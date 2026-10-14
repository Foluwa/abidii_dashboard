'use client';

import React from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { UrlTabs, type UrlTab } from '@/components/ui/url-tabs';
import { ReviewsTab } from './ReviewsTab';
import { AcquisitionOptionsTab } from './AcquisitionOptionsTab';
import { ConfigLink } from './shared';

const TABS: UrlTab[] = [
  { key: 'reviews', label: 'Reviews' },
  { key: 'acquisition', label: 'How did you hear' },
];

export function OnboardingContent() {
  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Onboarding" />
        <div className="mt-1 space-y-1 text-sm text-muted-foreground">
          <p>What new learners see while setting up the app: reviews from other learners and the &quot;How did you hear about Abidii?&quot; question.</p>
          <p>
            <ConfigLink>Switches and the welcome audio (onboarding.*): System → Configuration</ConfigLink>
          </p>
        </div>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="reviews"
        renderTab={(key) => (key === 'acquisition' ? <AcquisitionOptionsTab /> : <ReviewsTab />)}
      />
    </div>
  );
}
