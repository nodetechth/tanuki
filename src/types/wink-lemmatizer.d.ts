declare module "wink-lemmatizer" {
  const lemmatize: {
    verb(value: string): string;
    noun(value: string): string;
    adjective(value: string): string;
  };

  export default lemmatize;
}
