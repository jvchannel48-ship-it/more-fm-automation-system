export type TriviaComment={id:string;name:string;text:string;createdAt:number;deviceId:string}
export type TriviaPost={id:string;text:string;image?:string;createdAt:number;likes:string[];comments:TriviaComment[]}
