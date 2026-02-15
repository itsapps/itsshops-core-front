import { Context } from '@netlify/functions';

type PreviewParams = {
    request: Request;
    context: Context;
    projectConfig: any;
};
declare const preview: (props: PreviewParams) => Promise<Response>;

export { type PreviewParams, preview };
