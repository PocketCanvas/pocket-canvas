import { registerWebModule, NativeModule } from 'expo';

class StableDiffusionModule extends NativeModule<{}> {}

export default registerWebModule(StableDiffusionModule, 'StableDiffusionModule');
