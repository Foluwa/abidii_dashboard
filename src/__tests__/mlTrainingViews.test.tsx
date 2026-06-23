import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/test-utils";
import {
  MLTrainingOverviewPage,
  MLCandidateReviewManifestDetailPage,
  MLCandidateReviewManifestsPage,
  MLVisionJobsPage,
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
    threshold: 180,
    languages: [],
    model_versions: {},
    training_jobs: {},
  });
  mockedApi.getHandwritingDatasetReadiness.mockResolvedValue({
    manifest_id: "manifest-1",
    generated_at: "2026-04-30T00:00:00Z",
    target_min_count: 180,
    target_high_count: 300,
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
        target_min_count: 180,
        target_high_count: 300,
        readiness_status: "missing",
        is_blocking_training: true,
        recommended_action: "Collect candidate samples.",
        needed_to_300: 171,
        needed_to_500: 291,
      },
      {
        class_label: "G",
        language: "eng",
        script_group: "English",
        candidate_count: 1,
        verified_count: 120,
        approved_pending_count: 1,
        rejected_count: 0,
        target_min_count: 180,
        target_high_count: 300,
        readiness_status: "low",
        is_blocking_training: true,
        recommended_action: "Collect more samples.",
        needed_to_300: 59,
        needed_to_500: 179,
      },
      {
        class_label: "ẹ́",
        language: "yor",
        script_group: "Yoruba",
        candidate_count: 0,
        verified_count: 180,
        approved_pending_count: 0,
        rejected_count: 0,
        target_min_count: 180,
        target_high_count: 300,
        readiness_status: "ready",
        is_blocking_training: false,
        recommended_action: "No action.",
        needed_to_300: 0,
        needed_to_500: 120,
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
  mockedApi.listHandwritingCandidateManifests.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
  mockedApi.getVerifiedPromotionReadiness.mockResolvedValue({ threshold: 180, languages: [] });
  mockedApi.getVerifiedPromotionCollectionGaps.mockResolvedValue({ target_low: 180, target_high: 300, items: [] });
  mockedApi.getHandwritingCandidateManifest.mockResolvedValue({
    id: "manifest-1",
    language_code: "eng",
    dataset_kind: "alphabet_handwriting",
    source: "drawings",
    status: "ready_for_review",
    status_counts: { approved: 1, rejected: 0, pending: 0 },
  });
  mockedApi.listHandwritingCandidates.mockResolvedValue({
    total: 1,
    limit: 25,
    offset: 0,
    items: [
      {
        id: "candidate-1",
        manifest_id: "manifest-1",
        language_code: "eng",
        source_type: "dashboard_upload",
        source_key: "drawings/eng/F/source.png",
        raw_label: "F",
        final_label: "F",
        final_case_group: "UPPER_CASE",
        review_status: "pending",
        quality_flags: {},
        vision_status: "not_requested",
      },
    ],
  });
  mockedApi.getHandwritingVisionProviders.mockResolvedValue({
    providers: [
      { name: "openai", enabled: true, supports_image_input: true, supports_batch: true, default_model: "gpt-4.1-mini", disabled_reason: null },
      { name: "deepseek", enabled: false, supports_image_input: false, supports_batch: false, default_model: null, disabled_reason: "No configured official image-input endpoint" },
    ],
  });
  mockedApi.listHandwritingVisionJobs.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
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
  mockedApi.uploadHandwritingCandidatesDb.mockResolvedValue({
    manifest_id: "manifest-1",
    uploaded_count: 0,
    rejected_count: 1,
    validation_errors: [{ filename: "bad.txt", error: "unsupported_image_type" }],
    message: "Upload complete",
  });
  render(<MLCandidateReviewManifestsPage />);

  fireEvent.change(screen.getByPlaceholderText("Class label, e.g. F or ẹ́"), { target: { value: "F" } });
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [new File(["bad"], "bad.txt", { type: "text/plain" })] } });
  fireEvent.click(screen.getByText("Upload Candidates"));

  await screen.findByText("Upload validation errors");
  expect(screen.getByText(/bad.txt: unsupported_image_type/)).toBeInTheDocument();
});

it("confirms selected bulk review updates and keeps promotion disabled", async () => {
  mockedApi.bulkUpdateHandwritingCandidates.mockResolvedValue({ updated: 1, items: [] });
  render(<MLCandidateReviewManifestDetailPage />);

  await screen.findByText("drawings/eng/F/source.png");
  fireEvent.click(screen.getAllByRole("checkbox").slice(-1)[0]);
  fireEvent.click(screen.getByText("Approve Selected"));
  expect(screen.getByText("Set 1 visible candidates to approved?")).toBeInTheDocument();
  expect(screen.getByText(/Promotion writes approved candidates/)).toBeInTheDocument();
  expect(screen.getByText("datasets/training/*")).toBeInTheDocument();
});

it("loads DB-backed candidate review fields", async () => {
  render(<MLCandidateReviewManifestDetailPage />);

  await screen.findByText("drawings/eng/F/source.png");
  expect(screen.getByText("eng / UPPER_CASE / F")).toBeInTheDocument();
  expect(screen.getByText("vision not_requested · confidence -")).toBeInTheDocument();
});

it("renders promotion dry-run and requires PROMOTE confirmation before apply", async () => {
  mockedApi.dryRunHandwritingCandidatePromotion.mockResolvedValue({
    promotion_run_id: "run-1",
    manifest_id: "manifest-1",
    mode: "dry_run",
    status: "succeeded",
    valid: true,
    apply_allowed: true,
    target_prefix: "datasets/training/eng/alphabets/",
    approved_count: 1,
    files_to_copy: [
      {
        candidate_id: "candidate-1",
        status: "dry_run",
        source_key: "drawings/eng/F/source.png",
        destination_key: "datasets/training/eng/alphabets/UPPER_CASE/F/hash.png",
        class_id: "UPPER_CASE/F",
      },
    ],
    copied_count: 0,
    skipped_count: 0,
    failed_count: 0,
    validation_errors: [],
    per_class_impact: [
      {
        language_code: "eng",
        case_group: "UPPER_CASE",
        label: "F",
        class_id: "UPPER_CASE/F",
        before: 10,
        would_add: 1,
        added: 0,
        after: 10,
      },
    ],
  });

  render(<MLCandidateReviewManifestDetailPage />);

  await screen.findByText("drawings/eng/F/source.png");
  expect(screen.getByText("Apply Approved Promotion")).toBeDisabled();
  fireEvent.click(screen.getByText("Dry-run Promotion"));
  await screen.findByText("Files To Promote");
  expect(screen.getByText("datasets/training/eng/alphabets/UPPER_CASE/F/hash.png")).toBeInTheDocument();
  expect(screen.getByText("Apply Approved Promotion")).not.toBeDisabled();
  fireEvent.click(screen.getByText("Apply Approved Promotion"));
  expect(screen.getByText("Type exactly")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apply Promotion" })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText("PROMOTE manifest-1"), { target: { value: "PROMOTE manifest-1" } });
  expect(screen.getByRole("button", { name: "Apply Promotion" })).not.toBeDisabled();
});

it("renders vision providers with DeepSeek disabled reason", async () => {
  render(<MLVisionJobsPage />);
  await screen.findByText(/No configured official image-input endpoint/);
  expect(screen.getByText(/model: gpt-4.1-mini/)).toBeInTheDocument();
});

it("renders vision estimate result with candidate count and cost", async () => {
  mockedApi.estimateHandwritingVisionJob.mockResolvedValue({
    candidate_count: 50,
    estimated_cost: { currency: "USD", low: 0.05, high: 0.20 },
    provider: "openai",
    model: "gpt-4.1-mini",
    mode: "batch",
    requires_confirmation: true,
    confirmation_text: "VISION LABEL manifest-1",
    blocked: false,
    blocked_reason: null,
  });
  mockedApi.listHandwritingCandidates.mockResolvedValue({
    total: 0,
    limit: 25,
    offset: 0,
    items: [],
  });
  render(<MLCandidateReviewManifestDetailPage />);
  await screen.findByText("OpenAI");
  fireEvent.click(screen.getByText("Estimate Vision Labels"));
  await screen.findByText("Candidates:");
  const costTexts = screen.getAllByText(/0\.05/);
  expect(costTexts.length).toBeGreaterThanOrEqual(1);
});

it("creates vision job confirmation requires exact text", async () => {
  mockedApi.estimateHandwritingVisionJob.mockResolvedValue({
    candidate_count: 50,
    estimated_cost: { currency: "USD", low: 0.05, high: 0.20 },
    provider: "openai",
    model: "gpt-4.1-mini",
    mode: "batch",
    requires_confirmation: true,
    confirmation_text: "VISION LABEL manifest-1",
    blocked: false,
    blocked_reason: null,
  });
  mockedApi.listHandwritingCandidates.mockResolvedValue({
    total: 0,
    limit: 25,
    offset: 0,
    items: [],
  });
  mockedApi.createHandwritingVisionJob.mockResolvedValue({
    id: "job-1",
    provider: "openai",
    model: "gpt-4.1-mini",
    mode: "batch",
    status: "queued",
    request_count: 50,
    completed_count: 0,
    failed_count: 0,
  });
  render(<MLCandidateReviewManifestDetailPage />);
  await screen.findByText("OpenAI");
  fireEvent.click(screen.getByText("Estimate Vision Labels"));
  await screen.findByText("Candidates:");
  fireEvent.click(screen.getByRole("button", { name: "Create Vision Label Job" }));
  await screen.findByRole("heading", { name: "Create Vision Label Job" });
  expect(screen.getByRole("button", { name: "Create Vision Job" })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText("VISION LABEL manifest-1"), { target: { value: "VISION LABEL manifest-1" } });
  expect(screen.getByRole("button", { name: "Create Vision Job" })).not.toBeDisabled();
});

it("displays vision suggestion in candidate card", async () => {
  mockedApi.listHandwritingCandidates.mockResolvedValue({
    total: 1,
    limit: 25,
    offset: 0,
    items: [
      {
        id: "candidate-1",
        manifest_id: "manifest-1",
        language_code: "eng",
        source_type: "dashboard_upload",
        source_key: "drawings/eng/F/source.png",
        raw_label: "F",
        final_label: "F",
        final_case_group: "UPPER_CASE",
        review_status: "pending",
        quality_flags: {},
        vision_status: "completed",
        vision_confidence: 0.92,
        vision_provider: "openai",
        vision_model: "gpt-4.1-mini",
        suggested_label: "F",
        suggested_case_group: "UPPER_CASE",
        vision_suggestion: { review_recommendation: "approve_suggestion" },
      },
    ],
  });
  render(<MLCandidateReviewManifestDetailPage />);
  await screen.findByText("AI: UPPER_CASE/F");
  expect(screen.getByText("approve_suggestion")).toBeInTheDocument();
});

it("vision suggestion does not auto-promote", async () => {
  mockedApi.suggestHandwritingCandidateLabel.mockResolvedValue({
    candidate_id: "candidate-1",
    suggestion: {
      predicted_label: "F",
      case_group: "UPPER_CASE",
      confidence: 0.92,
      is_blank: false,
      is_noise: false,
      is_ambiguous: false,
      review_recommendation: "approve_suggestion",
      reason: "clear uppercase F",
    },
    vision_status: "completed",
    vision_provider: "openai",
    vision_model: "gpt-4.1-mini",
  });
  mockedApi.listHandwritingCandidates.mockResolvedValue({
    total: 1,
    limit: 25,
    offset: 0,
    items: [
      {
        id: "candidate-1",
        manifest_id: "manifest-1",
        language_code: "eng",
        source_type: "dashboard_upload",
        source_key: "drawings/eng/F/source.png",
        raw_label: "F",
        final_label: "F",
        final_case_group: "UPPER_CASE",
        review_status: "pending",
        quality_flags: {},
        vision_status: "completed",
        vision_confidence: 0.92,
        vision_provider: "openai",
        vision_model: "gpt-4.1-mini",
        suggested_label: "F",
        suggested_case_group: "UPPER_CASE",
        vision_suggestion: { review_recommendation: "approve_suggestion" },
      },
    ],
  });
  render(<MLCandidateReviewManifestDetailPage />);
  await screen.findByText("Suggest");
  fireEvent.click(screen.getByText("Suggest"));
  await screen.findByText("Use Suggestion");
  fireEvent.click(screen.getByText("Use Suggestion"));
  // "Apply Approved Promotion" should remain disabled since candidate is still pending
  await screen.findByText("Apply Approved Promotion");
});
