// First names AneQue greets in her own recorded voice ("Hey Rahul!"), from
// public/academy/voice/n/<name>.mp3. Any other name is said by the browser
// voice instead, so every member is still greeted by name.

export const NAME_BANK: ReadonlySet<string> = new Set(
  "aarav aarush aayush abdul abhay abhi abhinav abhishek adarsh aditi aditya adnan afreen afroz ahmad ahmed aisha ajay akash akhil akshay alex ali alia alice alok aman amar amir amit amrita anand ananya anas aneque anil anita anjali ankit ankita ankur anmol annie anshul anu anuj anupam anurag anushka aparna archana arif arjun arnav arpit arun aryan asad asha ashish ashok asif atul ayaan ayan ayesha azhar babu bharat bhavna bilal bob carlos chandan charlie chetan chirag chris daniel danish david deepa deepak deepika dev devansh dhruv dinesh divya emma faisal farah farhan fatima gaurav gautam geeta girish gopal govind gurpreet hamza hari harish harsh harshit hassan hemant himanshu hina hitesh imran irfan ishaan ishan ishita jack jacob james jasmine jatin javed jay jaya jitendra john jyoti kabir kajal kamal karan kartik kashif kavita kavya keshav kevin khalid kiran kishore krish krishna kunal lakshmi lalit leo liam lucas madhav mahesh maria mark mayank meera megha mehul michael mihir mike mohan mohit mohsin monika mukesh muskan nadeem naina naveed naveen navya neeraj neha nikhil nikita nilesh nisha nitin noah olivia om omar pallavi pankaj paras parth pawan pooja prabhat pradeep prakash pranav prashant pratik praveen preeti prem priya priyanka puneet rachit raghav rahul raj rajat rajesh raju rakesh ram raman ravi raza rehan reza ria rishabh rishi ritesh ritika riya rohan rohit ronak roshan ruchi rupesh saad sachin sahil sai sajid sakshi salman sam samir sana sandeep sanjana sanjay sara sarah saurabh shahid shivam shoaib shreya shubham siddharth simran sneha sohail sonal sonia sophia sourav subham sudhir sumit sunil sunny suraj suresh swati tanmay tanvi tarun tejas tom tushar uday umar umesh utkarsh vaibhav varun ved vicky vijay vikas vikram vinay vineet vipin vishal vivek yash yogesh yusuf zaid zara zoya".split(" "),
);

const TITLES = new Set(["md", "mohd", "mohd.", "md.", "mr", "mr.", "mrs", "ms", "dr", "dr.", "sri", "shri", "the"]);

/**
 * The name to greet someone by: the first real word of their display name
 * (skipping "Md", "Mr", "Dr"...), or their @handle without the @. Pure, for tests.
 */
export function greetName(display: string | null | undefined): string | null {
  const words = (display ?? "")
    .replace(/^@/, "")
    .split(/[\s_.-]+/)
    .map((w) => w.replace(/[^\p{L}'-]/gu, ""))
    .filter(Boolean);
  const first = words.find((w) => !TITLES.has(w.toLowerCase()));
  if (!first || first.length < 2 || first.length > 20) return null;
  return first[0].toUpperCase() + first.slice(1).toLowerCase();
}

/** Recorded "Hey <name>!" clip for this name, if one exists. */
export function nameClip(name: string): string | null {
  const k = name.toLowerCase();
  return NAME_BANK.has(k) ? `/academy/voice/n/${k}.mp3` : null;
}
