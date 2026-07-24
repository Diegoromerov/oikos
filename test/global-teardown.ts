export default async function globalTeardown(): Promise<void> {
  console.log('Cleaning up test environment...');
  
  if (global.__POSTGRES_CONTAINER__) {
    await global.__POSTGRES_CONTAINER__.stop();
  }
}