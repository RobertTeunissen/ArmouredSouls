import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';
import logger from '../../config/logger';

export interface ModerationResult {
  safe: boolean;
  robotLikely: boolean;
  scores: {
    neutral: number;
    drawing: number;
    hentai: number;
    porn: number;
    sexy: number;
  };
  robotLikenessScore: number;
  reason?: string;
}

interface ModerationThresholds {
  porn: number;
  hentai: number;
  sexy: number;
}

class ContentModerationService {
  private model: nsfwjs.NSFWJS | null = null;
  private modelLoaded = false;

  private moderationThresholds: ModerationThresholds = {
    porn: 0.3,
    hentai: 0.3,
    sexy: 0.5,
  };

  private robotLikenessThreshold = 0.6;

  async initialize(): Promise<void> {
    try {
      logger.info('Loading nsfwjs content moderation model...');
      this.model = await nsfwjs.load();
      this.modelLoaded = true;
      logger.info('Content moderation model loaded successfully');
    } catch (error) {
      this.model = null;
      this.modelLoaded = false;
      logger.error('Failed to load content moderation model:', error);
    }
  }

  async classifyImage(buffer: Buffer): Promise<ModerationResult> {
    if (!this.model || !this.modelLoaded) {
      return {
        safe: false,
        robotLikely: false,
        scores: { neutral: 0, drawing: 0, hentai: 0, porn: 0, sexy: 0 },
        robotLikenessScore: 0,
        reason: 'moderation_unavailable',
      };
    }

    let imageTensor: tf.Tensor3D | null = null;
    try {
      // Use sharp to decode image to raw RGB pixels, then create tensor
      const sharp = (await import('sharp')).default;
      const { data, info } = await sharp(buffer)
        .resize(224, 224) // nsfwjs MobileNetV2 expects 224×224
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      imageTensor = tf.tensor3d(
        new Uint8Array(data),
        [info.height, info.width, info.channels],
      );
      const predictions = await this.model.classify(imageTensor);

      const scores = this.predictionsToScores(predictions);
      const safe = this.evaluateSafety(scores);
      const robotLikenessScore = scores.drawing + scores.neutral;
      const robotLikely = robotLikenessScore >= this.robotLikenessThreshold;

      const result: ModerationResult = {
        safe,
        robotLikely,
        scores,
        robotLikenessScore,
      };

      if (!safe) {
        result.reason = 'nsfw_content';
      } else if (!robotLikely) {
        result.reason = 'low_robot_likeness';
      }

      return result;
    } catch (error) {
      logger.error('Error classifying image:', error);
      return {
        safe: false,
        robotLikely: false,
        scores: { neutral: 0, drawing: 0, hentai: 0, porn: 0, sexy: 0 },
        robotLikenessScore: 0,
        reason: 'moderation_unavailable',
      };
    } finally {
      if (imageTensor) {
        imageTensor.dispose();
      }
    }
  }

  isReady(): boolean {
    return this.modelLoaded;
  }

  private predictionsToScores(
    predictions: nsfwjs.PredictionType[],
  ): ModerationResult['scores'] {
    const scores: ModerationResult['scores'] = {
      neutral: 0,
      drawing: 0,
      hentai: 0,
      porn: 0,
      sexy: 0,
    };

    for (const prediction of predictions) {
      const className = prediction.className.toLowerCase() as keyof ModerationResult['scores'];
      if (className in scores) {
        scores[className] = prediction.probability;
      }
    }

    return scores;
  }

  private evaluateSafety(scores: ModerationResult['scores']): boolean {
    if (scores.porn >= this.moderationThresholds.porn) return false;
    if (scores.hentai >= this.moderationThresholds.hentai) return false;
    if (scores.sexy >= this.moderationThresholds.sexy) return false;
    return true;
  }
}

export const contentModerationService = new ContentModerationService();
