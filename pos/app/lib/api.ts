type ApiResponse<T> = {
  data?: T;
  message?: string;
};

export async function readApiData<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(payload.message ?? fallbackMessage);
  }

  if (payload.data === undefined) {
    throw new Error(fallbackMessage);
  }

  return payload.data;
}