import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/test-utils";
import {
  MLTrainingOverviewPage,
  MLVerifiedPromotionManifestDetailPage,
  MLVerifiedPromotionManifestsPage,
} from "@/components/admin/ml-training/MLTrainingViews";
import * as adminMlApi from "@/lib/adminMlApi";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "manifest-1" }),
}));

jest.mock("@/components/common/PageBreadCrumb", () => ({
  __esModule: true,
  default: ({ pageTitle }: { pageTitle: string }) => <div>{pageTitle}</div>,
}));

jest.mock("@/lib/adminMlApi");

const mockedApi = adminMlApi as jest.Mocked<typeof adminMlApi>;

function mockOverviewApi() {
  mockedApi.getMlReadiness.mockResolvedValue({
    generated_at: "2026-04-30T00:00:00Z",
    threshold: 300,
    languages: [],
    model_versions: {},
    training_jobs: {},
  });
  mockedApi.getHandwritingDatasetReadiness.mockResolvedValue({
    manifest_id: "manifest-1",
    generated_at: "2026-04-30T00:00:00Z",
    target_min_count: 300,
    target_high_count: 500,
    global_readiness: {
      total_classes: 3,
      ready_classes: 1,
      missing_classes: 1,
      low_classes: 1,
      blocking_classes: 2,
      approved_pending_samples: 1,
      can_run_dry_run_promotion: true,
      can_run_full_training: false,
      next_best_action: "Collect and review missing/low handwriting classes before training.",
    },
    classes: [
      {
        class_label: "F",
        language: "eng",
        script_group: "English",
        candidate_count: 9,
        verified_count: 0,
        approved_pending_count: 9,
        rejected_count: 0,
        target_min_count: 300,
        target_high_count: 500,
        readiness_status: "missing",
        is_blocking_training: true,
        recommended_action: "Collect candidate samples.",
        needed_to_300: 291,
        needed_to_500: 491,
      },
      {
        class_label: "G",
        language: "eng",
        script_group: "English",
        candidate_count: 1,
        verified_count: 120,
        approved_pending_count: 1,
        rejected_count: 0,
        target_min_count: 300,
        target_high_count: 500,
        readiness_status: "low",
        is_blocking_training: true,
        recommended_action: "Collect more samples.",
        needed_to_300: 179,
        needed_to_500: 379,
      },
      {
        class_label: "ẹ́",
        language: "yor",
        script_group: "Yoruba",
        candidate_count: 0,
        verified_count: 300,
        approved_pending_count: 0,
        rejected_count: 0,
        target_min_count: 300,
        target_high_count: 500,
        readiness_status: "ready",
        is_blocking_training: false,
        recommended_action: "No action.",
        needed_to_300: 0,
        needed_to_500: 200,
      },
    ],
  });
  mockedApi.listMlTrainingJobs.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
  mockedApi.listMlModelVersions.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOverviewApi();
  mockedApi.listVerifiedPromotionManifests.mockResolvedValue({ items: [] });
  mockedApi.getVerifiedPromotionReadiness.mockResolvedValue({ threshold: 300, languages: [] });
  mockedApi.getVerifiedPromotionCollectionGaps.mockResolvedValue({ target_low: 300, target_high: 500, items: [] });
  mockedApi.getVerifiedPromotionManifest.mockResolvedValue({
    id: "manifest-1",
    candidate_count: 1,
    status_counts: { approved: 1, rejected: 0, pending: 0 },
    validation_status: "valid",
    apply_status: "not_applied",
  });
  mockedApi.listVerifiedPromotionCandidates.mockResolvedValue({
    total: 1,
    limit: 25,
    offset: 0,
    items: [
      {
        candidate_id: "candidate-1",
        language: "eng",
        source_type: "dashboard_upload",
        source_key: "drawings/eng/F/source.png",
        label: "F",
        canonical_label: "F",
        proposed_verified_key: "datasets/verified/eng/alphabets/F/source.png",
        review_status: "pending",
        label_conflict: false,
      },
    ],
  });
});

it("filters readiness classes by search and status", async () => {
  render(<MLTrainingOverviewPage />);
  await screen.findByText("English F");
  expect(screen.getByText("English G")).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("Search class label"), { target: { value: "G" } });
  expect(screen.queryByText("English F")).not.toBeInTheDocument();
  expect(screen.getByText("English G")).toBeInTheDocument();

  fireEvent.change(screen.getByDisplayValue("All statuses"), { target: { value: "ready" } });
  expect(screen.queryByText("English G")).not.toBeInTheDocument();
});

it("shows upload validation errors from partial-success responses", async () => {
  mockedApi.uploadHandwritingCandidateSamples.mockResolvedValue({
    uploaded_count: 0,
    rejected_count: 1,
    validation_errors: [{ filename: "bad.txt", error: "unsupported_image_type" }],
  });
  render(<MLVerifiedPromotionManifestsPage />);

  fireEvent.change(screen.getByPlaceholderText("Class label, e.g. F or ẹ́"), { target: { value: "F" } });
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [new File(["bad"], "bad.txt", { type: "text/plain" })] } });
  fireEvent.click(screen.getByText("Upload Candidates"));

  await screen.findByText("Upload validation errors");
  expect(screen.getByText(/bad.txt: unsupported_image_type/)).toBeInTheDocument();
});

it("confirms selected bulk updates and renders structured dry-run preview", async () => {
  mockedApi.dryRunVerifiedPromotionManifest.mockResolvedValue({
    mode: "dry-run",
    valid: true,
    failed: 0,
    approved_rows: 1,
    files_to_copy: [{ source_key: "drawings/eng/F/source.png", target_key: "datasets/verified/eng/alphabets/F/source.png" }],
    per_class_impact: [{ language: "eng", label: "F", approved_pending: 1, before_verified_count: 2, after_verified_count: 2 }],
    manifest_updates: { verified_dataset_writes: 0 },
    skipped_files: [],
    validation_errors: [],
    before_verified_counts: { "eng:F": 2 },
  });
  render(<MLVerifiedPromotionManifestDetailPage />);

  await screen.findByText("drawings/eng/F/source.png");
  fireEvent.click(screen.getAllByRole("checkbox").slice(-1)[0]);
  fireEvent.click(screen.getByText("Approve Selected"));
  expect(screen.getByText("Set 1 visible candidates to approved?")).toBeInTheDocument();

  fireEvent.click(screen.getByText("Dry-run Promotion"));
  await screen.findByText("Files That Would Be Promoted");
  expect(screen.getByText("Per-Class Count Impact")).toBeInTheDocument();
  expect(screen.getByText(/Real apply is allowed by this dry-run preview/)).toBeInTheDocument();
});

it("keeps apply disabled until dry-run passes and requires exact confirmation text", async () => {
  mockedApi.dryRunVerifiedPromotionManifest.mockResolvedValue({
    mode: "dry-run",
    valid: true,
    failed: 0,
    approved_rows: 1,
    files_to_copy: [],
    per_class_impact: [],
    manifest_updates: {},
    skipped_files: [],
    validation_errors: [],
    before_verified_counts: {},
  });
  render(<MLVerifiedPromotionManifestDetailPage />);

  await screen.findByText("drawings/eng/F/source.png");
  expect(screen.getByText("Apply Approved Promotion")).toBeDisabled();
  fireEvent.click(screen.getByText("Dry-run Promotion"));
  await screen.findByText(/Real apply is allowed by this dry-run preview/);

  fireEvent.click(screen.getByText("Apply Approved Promotion"));
  expect(screen.getByText("Type exactly")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apply Promotion" })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText("APPLY manifest-1"), { target: { value: "APPLY manifest-1" } });
  expect(screen.getByRole("button", { name: "Apply Promotion" })).not.toBeDisabled();
});
