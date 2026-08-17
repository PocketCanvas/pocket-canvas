import { registerWebModule, NativeModule } from 'expo';

import { StableDiffusionModuleEvents } from './StableDiffusion.types';

class StableDiffusionModule extends NativeModule<StableDiffusionModuleEvents> {}

export default registerWebModule(StableDiffusionModule, 'StableDiffusionModule');
