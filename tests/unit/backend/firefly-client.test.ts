import {
    FireFlyClient,
    FireFlyClientImpl,
    FireFlyConnectionError,
    FireFlyError,
    FireFlyHttpError,
    FireFlyResponseError,
} from "../../../backend/src/services/firefly-client.js";

describe("FireFlyClient", () => {
    let mockFetch: jest.Mock;
    let client: FireFlyClient;

    const defaultUrl = "http://127.0.0.1:5001";
    const defaultNamespace = "default";
    const defaultApiName = "sanctionsv2.0";

    beforeEach(() => {
        mockFetch = jest.fn();
        client = new FireFlyClientImpl({
            baseUrl: defaultUrl,
            namespace: defaultNamespace,
            apiName: defaultApiName,
            fetchFn: mockFetch as unknown as typeof fetch,
        });
    });

    describe("Constructor and configuration", () => {
        it("should strip trailing slashes from baseUrl", () => {
            const c = new FireFlyClientImpl({
                baseUrl: "http://127.0.0.1:5001///",
                fetchFn: mockFetch as unknown as typeof fetch,
            });
            expect(c.baseUrl).toBe("http://127.0.0.1:5001");
        });

        it("should reject an empty baseUrl", () => {
            expect(
                () =>
                    new FireFlyClientImpl({
                        baseUrl: "",
                        fetchFn: mockFetch as unknown as typeof fetch,
                    }),
            ).toThrow(FireFlyError);
        });

        it("should reject an invalid baseUrl URL", () => {
            expect(
                () =>
                    new FireFlyClientImpl({
                        baseUrl: "not-a-url",
                        fetchFn: mockFetch as unknown as typeof fetch,
                    }),
            ).toThrow(FireFlyError);
        });
    });

    describe("invoke", () => {
        it("should call FireFly invoke endpoint with confirm=true query parameter", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ id: "tx-123" }),
            });

            const result = await client.invoke("CreateLicense", {
                licenseID: "LIC001",
                credits: 30,
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0];

            expect(url).toBe(
                "http://127.0.0.1:5001/api/v1/namespaces/default/apis/sanctionsv2.0/invoke/CreateLicense?confirm=true",
            );
            expect(options.method).toBe("POST");
            expect(options.headers).toEqual({
                "Content-Type": "application/json",
                Accept: "application/json",
            });
            expect(JSON.parse(options.body)).toEqual({
                input: {
                    licenseID: "LIC001",
                    credits: 30,
                },
            });
            expect(result).toEqual({ id: "tx-123" });
        });

        it("should handle 204 No Content response gracefully", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 204,
                text: async () => "",
            });

            const result = await client.invoke("CreateLicense", {
                licenseID: "LIC001",
                credits: 30,
            });

            expect(result).toBeUndefined();
        });

        it("should reject empty method name", async () => {
            await expect(client.invoke("", {})).rejects.toThrow(FireFlyError);
            await expect(client.invoke("   ", {})).rejects.toThrow(FireFlyError);
        });
    });

    describe("query", () => {
        it("should call FireFly query endpoint without confirm=true parameter", async () => {
            const expectedResponse = {
                id: "LIC001",
                credits: 25,
                status: "ACTIVE",
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => JSON.stringify(expectedResponse),
            });

            const result = await client.query("GetLicense", {
                licenseID: "LIC001",
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0];

            expect(url).toBe(
                "http://127.0.0.1:5001/api/v1/namespaces/default/apis/sanctionsv2.0/query/GetLicense",
            );
            expect(options.method).toBe("POST");
            expect(options.headers).toEqual({
                "Content-Type": "application/json",
                Accept: "application/json",
            });
            expect(JSON.parse(options.body)).toEqual({
                input: {
                    licenseID: "LIC001",
                },
            });
            expect(result).toEqual(expectedResponse);
        });
    });

    describe("Error Handling", () => {
        it("should throw FireFlyConnectionError on network failure", async () => {
            mockFetch.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5001"));

            await expect(
                client.invoke("CreateLicense", { licenseID: "LIC001" }),
            ).rejects.toThrow(FireFlyConnectionError);
        });

        it("should preserve original error as cause on network failure", async () => {
            const originalError = new TypeError("Failed to fetch");
            mockFetch.mockRejectedValueOnce(originalError);

            try {
                await client.query("GetLicense", { licenseID: "LIC001" });
                fail("Expected FireFlyConnectionError to be thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(FireFlyConnectionError);
                expect((err as FireFlyConnectionError).cause).toBe(originalError);
            }
        });

        it("should throw FireFlyHttpError on HTTP 400 with parsed FireFly error message", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: "Bad Request",
                text: async () =>
                    JSON.stringify({ error: "FF10234: Invalid input parameters" }),
            });

            try {
                await client.invoke("IssueSanction", {});
                fail("Expected FireFlyHttpError to be thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(FireFlyHttpError);
                const httpError = err as FireFlyHttpError;
                expect(httpError.statusCode).toBe(400);
                expect(httpError.message).toBe("FF10234: Invalid input parameters");
                expect(httpError.responseBody).toEqual({
                    error: "FF10234: Invalid input parameters",
                });
            }
        });

        it("should throw FireFlyHttpError on HTTP 404 with status text fallback", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: "Not Found",
                text: async () => "",
            });

            try {
                await client.query("GetLicense", { licenseID: "NON_EXISTING" });
                fail("Expected FireFlyHttpError to be thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(FireFlyHttpError);
                const httpError = err as FireFlyHttpError;
                expect(httpError.statusCode).toBe(404);
                expect(httpError.message).toContain("404");
            }
        });

        it("should throw FireFlyHttpError on HTTP 500 server error", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                text: async () =>
                    JSON.stringify({
                        message: "chaincode response 500, license not found",
                    }),
            });

            try {
                await client.invoke("IssueSanction", {});
                fail("Expected FireFlyHttpError to be thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(FireFlyHttpError);
                const httpError = err as FireFlyHttpError;
                expect(httpError.statusCode).toBe(500);
                expect(httpError.message).toBe(
                    "chaincode response 500, license not found",
                );
            }
        });

        it("should throw FireFlyResponseError when response is not valid JSON", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => "<html><body>Bad Gateway</body></html>",
            });

            await expect(
                client.query("GetLicense", { licenseID: "LIC001" }),
            ).rejects.toThrow(FireFlyResponseError);
        });
    });
});
