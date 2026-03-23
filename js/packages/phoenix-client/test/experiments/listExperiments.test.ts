import { DEFAULT_PHOENIX_BASE_URL } from "@arizeai/phoenix-config";
import { createPhoenixMswServer } from "@arizeai/phoenix-testing";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { listExperiments } from "../../src/experiments/listExperiments";

const listExperimentsHttpPath = `${DEFAULT_PHOENIX_BASE_URL}/v1/datasets/:datasetId/experiments`;

const mockExperiments: components["schemas"]["ListExperimentsResponseBody"]["data"] =
  [
    {
      id: "exp-1",
      dataset_id: "dataset-123",
      dataset_version_id: "v1",
      repetitions: 1,
      metadata: { model: "gpt-4" },
      project_name: "test-project",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      example_count: 10,
      successful_run_count: 8,
      failed_run_count: 2,
      missing_run_count: 0,
    },
    {
      id: "exp-2",
      dataset_id: "dataset-123",
      dataset_version_id: "v2",
      repetitions: 2,
      metadata: {},
      project_name: null,
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
      example_count: 5,
      successful_run_count: 5,
      failed_run_count: 0,
      missing_run_count: 0,
    },
  ];

const server = createPhoenixMswServer();

describe("listExperiments", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("should list experiments without pagination if no next_cursor", async () => {
    const requestUrls: string[] = [];

    server.use(
      http.get(listExperimentsHttpPath, ({ request }) => {
        requestUrls.push(request.url);
        return HttpResponse.json({
          data: mockExperiments,
        });
      })
    );

    const experiments = await listExperiments({ datasetId: "dataset-123" });

    expect(requestUrls).toHaveLength(1);
    const url = new URL(requestUrls[0] ?? "");
    expect(url.pathname).toBe("/v1/datasets/dataset-123/experiments");
    expect(url.searchParams.get("limit")).toBe("50");
    const cursorParam = url.searchParams.get("cursor");
    expect(cursorParam === null || cursorParam === "").toBe(true);

    expect(experiments).toHaveLength(2);
    expect(experiments[0]).toMatchObject({
      id: "exp-1",
      datasetId: "dataset-123",
      datasetVersionId: "v1",
      repetitions: 1,
      projectName: "test-project",
      exampleCount: 10,
      successfulRunCount: 8,
      failedRunCount: 2,
      missingRunCount: 0,
    });
    expect(experiments[1]).toMatchObject({
      id: "exp-2",
      datasetId: "dataset-123",
      projectName: null,
    });
  });

  it("should paginate through records and fetch all experiments", async () => {
    let callIndex = 0;
    const requestUrls: string[] = [];
    const paginatedBodies: Array<
      components["schemas"]["ListExperimentsResponseBody"]
    > = [
      {
        data: [mockExperiments[0]!],
        next_cursor: "cursor1",
      },
      {
        data: [mockExperiments[1]!],
        next_cursor: "cursor2",
      },
      {
        data: mockExperiments,
        next_cursor: null,
      },
    ];

    server.use(
      http.get(listExperimentsHttpPath, ({ request }) => {
        requestUrls.push(request.url);
        const body = paginatedBodies[callIndex];
        callIndex += 1;
        return HttpResponse.json(body);
      })
    );

    const experiments = await listExperiments({ datasetId: "dataset-123" });

    expect(callIndex).toBe(3);
    expect(experiments).toHaveLength(4);
    expect(new URL(requestUrls[1] ?? "").searchParams.get("cursor")).toBe(
      "cursor1"
    );
  });

  it("should throw error if API returns no data", async () => {
    server.use(
      http.get(listExperimentsHttpPath, () => {
        return HttpResponse.json({});
      })
    );

    await expect(listExperiments({ datasetId: "dataset-123" })).rejects.toThrow(
      "Failed to list experiments"
    );
  });

  it("should handle empty metadata", async () => {
    server.use(
      http.get(listExperimentsHttpPath, () => {
        return HttpResponse.json({
          data: [
            {
              ...mockExperiments[0],
              metadata: null,
            },
          ],
        });
      })
    );

    const experiments = await listExperiments({ datasetId: "dataset-123" });

    expect(experiments[0]?.metadata).toEqual({});
  });
});
