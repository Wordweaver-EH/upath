export class LLMResponseError extends Error {
  public readonly responseText: string;
  
  constructor(message: string, responseText: string) {
    super(message);
    this.name = 'LLMResponseError';
    this.responseText = responseText;
  }
}