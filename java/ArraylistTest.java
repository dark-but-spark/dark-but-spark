class ArraylistText{
    public static void main(String[] args) {
        // Create an ArrayList
        java.util.ArrayList<String> list = new java.util.ArrayList<>();

        // Add elements to the ArrayList
        list.add("Apple");
        list.add("Banana");
        list.add("Cherry");

        // Print the ArrayList
        System.out.println("ArrayList: " + list);

        // Get an element from the ArrayList
        String fruit = list.get(1);
        System.out.println("Element at index 1: " + fruit);

        // Remove an element from the ArrayList
        list.remove("Banana");
        System.out.println("ArrayList after removal: " + list);
    }
}