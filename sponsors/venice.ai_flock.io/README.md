# MeSu AI planned usage of Venice.AI, FLock.io

Dear Lorenzo, Elizbeth and Yifan,

Thanks for the sponsorship of the hackathon.  

## Background

Please find MeSu.AI Studio slides pitch deck and video:

1. [Canva](https://www.canva.com/design/DAGkCZI1MrI/sVxTueasCmGOesZAKfXKNg/view?utm_content=DAGkCZI1MrI&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h882697b042)
2. [![MeSu AI Studio - An AI/Web3 Bridge Linking Global GenZ fanfiction Communities and Global Brands](https://img.youtube.com/vi/DrSegfnhMOI/1.jpg)](https://www.youtube.com/watch?v=DrSegfnhMOI)

Baiscally we are building the best multimodality UGC AI Writer Agent, retaining author's original creative intent, based on user preference, plus ability to match and embedded Brands IPs; thus introducing global brands into an untapped huge global GenZ community.

## Current offerings

## Venice.AI

- Image generator: we tested image generator like SD / Flux, but in comparison MJ latest version is still better, plus OpenAI 4o dramatically improved its image generation and modification capacity.  

> We were wondering if Venice.AI could support LoRA adapters like CivitAI? or like RunComfy.com to support ComfyUI, via Docker + Kasm workspace? 
> Note dynamic LoRA support also gives us unique benefits below when using our own fine tuned DeepSeek R1 GRPO LoRA/QLoRA.  Dynamic loading is supported in **vLLM** but I haven't tested.  Another open source implementation is https://github.com/predibase/lorax

- Video generator: not available on Venice.AI.  We tested hosted Tencent Hunyuan and Alibaba Wan 2.1, both are quite impressive, only 5 seconds though.  
> Would love to see they are being offered via Venice.AI platform.

- Resoning model: thanks for the DeepSeek R1 full version hosting.  We compared DeepSeek R1 vs Google AI Studio with Gemini 2.5 Pro Preview 03-25, the latter is better in terms of much longer context window, but DeepSeek R1 will generate something very creative.


## FLock.io 

For our use case, we didn't use existing AI Arena models or model fine-tuning competition.  Instead as discussed with Mr Xie earlier, we target Big Next Retail App (given Global Big Brands AI solution to tap into this ~100M+ GenZ community), we use a combination of various our existing AI tools(Mj/Gemini 2.5 Pro, ...) + 3 APIs from Venice.AI, we propose the following AI Arena and FL Alliance colaboration.

### Objective: 

Basically we need the best reasoning AI Writer model that can fuse the following 3 things together:
1. Author's original creative intent
2. User preference (for UGC generation)
3. Matching Brands IP for story(text)/image/short-video embedding

DeepSeek R1 GRPO (Group Relative Policy Optimization) fine-tuning gives the best chance to archieve this. GRPO was designed for full model fine tuning which requires too much computation, but thanks to Unsloth, they managed to enable LoRA/QLoRA fine tuning, still experimental though.  Here's the draft code snippets, how we are going to build the world's best Reasoning AI writer LLM.

### Loading foundation model

`requirements.txt`
```text
unsloth
vllm
... bleu, rogue, meteor, ...
```

Loading foundation model:

```python
from unsloth import FastLanguageModel
import torch
max_seq_length = 2048 # Can increase for longer reasoning traces
lora_rank = 64 # Larger rank = smarter, but slower

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "meta-llama/Llama-3.2-3B-Instruct",
    max_seq_length = max_seq_length,
    load_in_4bit = False, # False for LoRA 16bit
    fast_inference = True, # Enable vLLM fast inference
    max_lora_rank = lora_rank,
    gpu_memory_utilization = 0.8, # Reduce if out of memory
)

model = FastLanguageModel.get_peft_model(
    model,
    r = lora_rank, # Choose any number > 0 ! Suggested 8, 16, 32, 64, 128
    target_modules = [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ], # Remove QKVO if out of memory
    lora_alpha = lora_rank,
    use_gradient_checkpointing = "unsloth", # Enable long context finetuning
    random_state = 3407,
)
```

### Data Prep

Unsloth's objective is a reasoning math model using GSM8K training datasets. 

```python
from datasets import load_dataset
dataset = load_dataset("openai/gsm8k", "main", split = "train")
dataset[0]["question"]
dataset[0]["answer"]
```

We need to build our own training dataset, leveraing millions of completed, open source books, using distilling method from larger reasoning models. 

1. Assuming we have a `Book`, with Chapter[0] is `metadata`, like author, date version, summary... and `Chapter[1]-[n]`
2. Create `[n-1]` Training Pair: `{existing_chapters, output_chapter}`, using markdown block `text` to join each chapter without interference

- Chapter[0] + Chapter[1] --> Chapter[2]
- Chapter[0] + Chapter[1]+[2] --> Chapter[3]
- Chapter[0] + Chapter[1]+[2]+[3] --> Chapter[4]
- ...
- Chapter[0] + Chapter[1]+[2]+[3]+...[n-1] --> Chapter[n]

3. For each training pair, use a resoning model to ask why new chapter is the way it is based on input chapters, wrap the result in <thinking> or <reasoning> tags, so we have a trippler training dataset: `{existing_chapters, output_chapter, reasoning}`.

### System Prompt and mapping of training dataset
```python
reasoning_start = "<start_working_out>"
reasoning_end   = "<end_working_out>"
solution_start = "<SOLUTION>"
solution_end = "</SOLUTION>"

system_prompt = \
f"""You are an AI Writer, retaining author's original creative intent.
Think about the existing chapters, roles, characteristics, plots, hints, scenes, locations.
Place it between {reasoning_start} and {reasoning_end}.
Then, provide your solution between {output_start}{output_end}"""
system_prompt

dataset = dataset.map(lambda x: {
    "prompt" : [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": x["existing_chapters"]},
    ],
    "answer": extract_hash_answer(x["output_chapters"]),
})
dataset[0]

# We create a regex format to match the reasoning sections and answers:
import re
match_format = re.compile(
    rf"^[\s]{{0,}}"\
    rf"{reasoning_start}.+?{reasoning_end}.*?"\
    rf"{solution_start}(.+?){solution_end}"\
    rf"[\s]{{0,}}$",
    flags = re.MULTILINE | re.DOTALL
)
```

### Reward Functions

Unsloth's simply math rewarding function is matching the training answer, for our use case, a bit more complex :) 
```python
def match_format_exactly(completions, **kwargs):
    scores = []
    for completion in completions:
        score = 0
        response = completion[0]["content"]
        # Match if format is seen exactly!
        if match_format.search(response) is not None: score += 3.0
        scores.append(score)
    return scores
```

Instead, we could try the following NLP metrics:
Source: https://www.digitalocean.com/community/tutorials/automated-metrics-for-evaluating-generated-text

- **BLEU**
- **ROGUE-1, ROGUE-2, ROGUE-L**
- **Perplexity**
- **BERTScore**
- **METEOR**


```python
def calculate_rouge(candidate, reference): ...
def calculate_meteor(candidate, reference):...
def calculate_bleu(candidate, reference):...
```

Also, if the generated chapter is smaller than embedding model we use, e.g. OpenAI text-embedding-v3, 8192.  Then we can calcualte cosine distance too:

```python
def consine distance(candidate_embedding_vector, reference_embedding_vector):...

```

### Trainig the model

Set up GRPO Trainer and all configurations, note the Rewarding Functions:

```python
max_prompt_length = 287 + 1 # + 1 just in case!

from trl import GRPOConfig, GRPOTrainer
training_args = GRPOConfig(
    learning_rate = 5e-6,
    weight_decay = 0.1,
    warmup_ratio = 0.1,
    lr_scheduler_type = "cosine",
    optim = "adamw_torch_fused",
    logging_steps = 1,
    per_device_train_batch_size = 1,
    gradient_accumulation_steps = 4, # Increase to 4 for smoother training
    num_generations = 8, # Decrease if out of memory
    max_prompt_length = max_prompt_length,
    max_completion_length = max_seq_length - max_prompt_length,
    # num_train_epochs = 1, # Set to 1 for a full training run
    max_steps = 1000,
    save_steps = 250,
    max_grad_norm = 0.1,
    report_to = "none", # Can use Weights & Biases
    output_dir = "outputs",
)

trainer = GRPOTrainer(
    model = model,
    processing_class = tokenizer,
    reward_funcs = [
        calculate_rouge, 
        calculate_meteor,
        calculate_bleu,
        consine distance,
    ],
    args = training_args,
    train_dataset = dataset,
)
trainer.train()
```

### Inference

Test new trainig model. First try it without GRPO LoRA:

```python
text = tokenizer.apply_chat_template([
    {"role": "user", "content": 
"""
Given the existing novel:

Chapter 1
'''text
...
'''
Chapter 2
'''text
...
'''
Write the next chapter, it can be a bit sad, but not a tragedy please",
"""
    },
], tokenize = False, add_generation_prompt = True)

from vllm import SamplingParams
sampling_params = SamplingParams(
    temperature = 0.8,
    top_p = 0.95,
    max_tokens = 1024,
)
output = model.fast_generate(
    [text],
    sampling_params = sampling_params,
    lora_request = None,
)[0].outputs[0].text

output
```

with LoRA, save LoRA, and verify if it's actually trained:
```python
model.save_lora("grpo_saved_lora")

from safetensors import safe_open

tensors = {}
with safe_open("grpo_saved_lora/adapter_model.safetensors", framework = "pt") as f:
    # Verify both A and B are non zero
    for key in f.keys():
        tensor = f.get_tensor(key)
        n_zeros = (tensor == 0).sum() / tensor.numel()
        assert(n_zeros.item() != tensor.numel())
```

```python
messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user",   "content": "...copy above..."},
]
text = tokenizer.apply_chat_template(
    messages,
    add_generation_prompt = True, # Must add for generation
    tokenize = False,
)
from vllm import SamplingParams
sampling_params = SamplingParams(
    temperature = 0.8,
    top_p = 0.95,
    max_tokens = 1024,
)
output = model.fast_generate(
    text,
    sampling_params = sampling_params,
    lora_request = model.load_lora("grpo_saved_lora"),
)[0].outputs[0].text

output
```

### Post Training Savings

for vLlM:
```python
# Merge to 16bit
if False: model.save_pretrained_merged("model", tokenizer, save_method = "merged_16bit",)
if False: model.push_to_hub_merged("hf/model", tokenizer, save_method = "merged_16bit", token = "")

# Merge to 4bit
if False: model.save_pretrained_merged("model", tokenizer, save_method = "merged_4bit",)
if False: model.push_to_hub_merged("hf/model", tokenizer, save_method = "merged_4bit", token = "")

# Just LoRA adapters
if False: model.save_pretrained_merged("model", tokenizer, save_method = "lora",)
if False: model.push_to_hub_merged("hf/model", tokenizer, save_method = "lora", token = "")
```

for GGUF/llama.cpp/Ollama:

```python
# Save to 8bit Q8_0
if False: model.save_pretrained_gguf("model", tokenizer,)
# Remember to go to https://huggingface.co/settings/tokens for a token!
# And change hf to your username!
if False: model.push_to_hub_gguf("hf/model", tokenizer, token = "")

# Save to 16bit GGUF
if False: model.save_pretrained_gguf("model", tokenizer, quantization_method = "f16")
if False: model.push_to_hub_gguf("hf/model", tokenizer, quantization_method = "f16", token = "")

# Save to q4_k_m GGUF
if False: model.save_pretrained_gguf("model", tokenizer, quantization_method = "q4_k_m")
if False: model.push_to_hub_gguf("hf/model", tokenizer, quantization_method = "q4_k_m", token = "")

# Save to multiple GGUF options - much faster if you want multiple!
if False:
    model.push_to_hub_gguf(
        "hf/model", # Change hf to your username!
        tokenizer,
        quantization_method = ["q4_k_m", "q8_0", "q5_k_m",],
        token = "",
    )
```

### Next steps

#### **AI Arena Scoring of the AI Writer Model**

Hopefully I've clearly explained our thought process and plan.  As to the AI Arena scoring, not like GSM8K math competition which has only one answer, in our case each reader might have different opinion on AI generated contents. But the rewarding functions above discussed could still be used for AI Arena, via Test datasets (i.e. we split open source book dataset, 70% for training, 30% for testing).

#### **Brands IP Matching Embedded AD Service**
This bit our current thought process is our reasoning AI Writer generates a few options for embedding Brands IP, but MeSu AI system prompt will not be changed (i.e. natural, subtle embedding without disrupting the user reading experience based on author's creative intent).  So here we are back to the test and proven appoach in media industry: Human In the Loop, let Brand decide which option to accept.

Your feedback is much welcome and appreciated!

Kind regards,
Charles
