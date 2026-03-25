/* © Andy Bell - https://buildexcellentwebsit.es/ */

type Token = { name: string; value: any }

const tokenKey = (name: string) => name.toLowerCase().replace(/[\s-]+/g, '-')

export const tokensToTailwind = (tokens: Token[]): Record<string, any> => {
  const response: Record<string, any> = {};

  tokens.forEach(({name, value}) => {
    response[tokenKey(name)] = value;
  });

  return response;
};
