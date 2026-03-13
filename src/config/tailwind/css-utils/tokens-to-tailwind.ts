/* © Andy Bell - https://buildexcellentwebsit.es/ */
import slugify from '@sindresorhus/slugify';

type Token = { name: string; value: any }

export const tokensToTailwind = (tokens: Token[]): Record<string, any> => {
  const nameSlug = (text: string) => slugify(text, { lowercase: true });
  const response: Record<string, any> = {};

  tokens.forEach(({name, value}) => {
    response[nameSlug(name)] = value;
  });

  return response;
};
