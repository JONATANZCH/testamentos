export interface EnvConfig {
  environment: 'dev' | 'prod' | 'qa';
  PORT?: number;
  AWSREGION: string;
  AWS_SECRET_ID: string;
  QUEUE_WILLS_COMMUNICATIONS: string;
  PPERRORMANAGEMENT: string;
  GETSNSTOPICARN: string;
  SQSCOMM_NOWAIT_QUEUE: string;
  EMAIL_FROM: string;
  SG_SEND_WILLS: string;
  BUCKET_WILL: string;
}
